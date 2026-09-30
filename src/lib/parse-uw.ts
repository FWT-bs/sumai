import type { DayIndex, ParsedMeeting, ParseResult } from "./types";
import { parseDayCodes, parseTimeRange } from "./time";

/**
 * Reads a pasted UW schedule and recovers the weekly meetings from it.
 *
 * UW students copy their schedule out of several places and none of them agree
 * on a layout, so this scans for the two things every format does contain — a
 * day spec and a time range — instead of expecting fixed columns:
 *
 *   MyUW registration table   ENGL 131  A  5.0  MWF  10:30 AM - 11:20 AM  MGH 241
 *   Time Schedule row         12345 A 5 MWF 830-920 KNE 130 Smith,John
 *   MyPlan / visual schedule  CSE 142 A
 *                             Lecture
 *                             MWF 9:30 AM - 10:20 AM
 *                             KNE 130
 */

const TIME = String.raw`\d{1,2}:\d{2}|\d{3,4}|\d{1,2}`;
const MERIDIEM = String.raw`(?:\s*(?:[ap]\.?m\.?|[ap])(?![a-z]))?`;
const RANGE_RE = new RegExp(
  `\\b(${TIME})${MERIDIEM}\\s*(?:-|–|—|−|\\bto\\b)\\s*(${TIME})${MERIDIEM}`,
  "gi",
);

/** "CSE 142", "A A 210", "B BIO 180" — a department code plus a course number. */
const COURSE_RE = /\b((?:[A-Z&]{1,6}\s){0,2}[A-Z&]{2,6})\s?(\d{3})\b(?![\d:.-])/g;

/** A line that is nothing but a room: "KNE 130", "CSE2 G20", "MGH 241". */
const ROOM_ONLY_RE = /^[A-Z][A-Z0-9&]{1,5}(?:\s[A-Z0-9]{1,6})?\s?\*?$/;

const UNSCHEDULED_RE = /\b(TBA|TBD|to be arranged|no meeting|online|asynchronous)\b/i;

/** Shortest and longest a real class meeting can be, in minutes. */
const MIN_MEETING = 20;
const MAX_MEETING = 360;

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokenize(segment: string): Token[] {
  const tokens: Token[] = [];
  const re = /[^\s,/&|;]+/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(segment)) !== null) {
    tokens.push({ text: hit[0], start: hit.index, end: hit.index + hit[0].length });
  }
  return tokens;
}

/**
 * Finds the day spec nearest the end of `segment`. Walks backwards over a run
 * of adjacent day tokens so that both "MWF" and "Monday, Wednesday, Friday"
 * come back whole, and stops at the first token that is not a day so a course
 * code or a credit count never leaks in.
 */
function daysBefore(segment: string): DayIndex[] | null {
  const tokens = tokenize(segment);
  const collected = new Set<DayIndex>();
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const days = parseDayCodes(tokens[i].text);
    if (days) {
      for (const day of days) collected.add(day);
      continue;
    }
    if (collected.size) break;
  }
  if (!collected.size) return null;
  return [...collected].sort((a, b) => a - b);
}

function courseCodesIn(line: string): Array<{ label: string; index: number }> {
  const found: Array<{ label: string; index: number }> = [];
  COURSE_RE.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = COURSE_RE.exec(line)) !== null) {
    const dept = hit[1].replace(/\s+/g, " ").trim();
    // "MWF 830" reads as a course code but is a day spec and a start time.
    if (parseDayCodes(dept)) continue;
    found.push({ label: `${dept} ${hit[2]}`, index: hit.index });
  }
  return found;
}

function locationAfter(line: string, from: number): string | null {
  const tail = line.slice(from).trim();
  if (!tail) return null;
  // Instructor names trail the room in Time Schedule rows; cut at the comma.
  const room = /^([A-Z][A-Z0-9&]{1,5}\s?[A-Z0-9]{1,6}\*?)\b/.exec(tail);
  if (!room) return null;
  return room[1].replace(/\*$/, "").trim();
}

export function parseUwSchedule(input: string): ParseResult {
  const lines = input
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "  ").replace(/[ ]{2,}/g, "  ").trim())
    .filter(Boolean);

  const meetings: ParsedMeeting[] = [];
  const skipped: string[] = [];

  let currentLabel: string | null = null;
  let carriedDays: DayIndex[] | null = null;
  /** Meetings produced by the previous line, so a trailing room line can land. */
  let previousBatch: ParsedMeeting[] = [];

  for (const line of lines) {
    const courses = courseCodesIn(line);

    RANGE_RE.lastIndex = 0;
    const ranges: Array<{ text: string; start: number; end: number }> = [];
    let hit: RegExpExecArray | null;
    while ((hit = RANGE_RE.exec(line)) !== null) {
      ranges.push({ text: hit[0], start: hit.index, end: hit.index + hit[0].length });
    }

    if (!ranges.length) {
      if (UNSCHEDULED_RE.test(line) && courses.length) {
        skipped.push(line);
        currentLabel = courses[0].label;
        previousBatch = [];
        continue;
      }
      // A bare room line belongs to the meetings just above it.
      if (
        previousBatch.length &&
        previousBatch.every((m) => !m.location) &&
        ROOM_ONLY_RE.test(line)
      ) {
        for (const meeting of previousBatch) meeting.location = line.replace(/\*$/, "").trim();
        continue;
      }
      if (courses.length) {
        currentLabel = courses[0].label;
        previousBatch = [];
        continue;
      }
      const days = daysBefore(line);
      if (days) carriedDays = days;
      previousBatch = [];
      continue;
    }

    // A course code to the left of the first time is this line's own class.
    const leading = courses.find((c) => c.index < ranges[0].start);
    if (leading) currentLabel = leading.label;

    const batch: ParsedMeeting[] = [];
    let cursor = 0;

    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i];
      const parsed = parseTimeRange(range.text);
      const segment = line.slice(cursor, range.start);
      cursor = range.end;

      const days = daysBefore(segment) ?? carriedDays;
      if (!parsed || !days) {
        if (parsed && !days) skipped.push(line);
        continue;
      }
      const duration = parsed.end - parsed.start;
      if (duration < MIN_MEETING || duration > MAX_MEETING) continue;

      carriedDays = days;
      const nextStart = ranges[i + 1]?.start ?? line.length;
      const location = locationAfter(line.slice(0, nextStart), range.end);

      for (const day of days) {
        batch.push({
          label: currentLabel ?? "Class",
          location,
          day,
          start: parsed.start,
          end: parsed.end,
        });
      }
    }

    meetings.push(...batch);
    previousBatch = batch;
  }

  return { meetings: dedupe(meetings), skipped: [...new Set(skipped)] };
}

export function dedupe(meetings: ParsedMeeting[]): ParsedMeeting[] {
  const seen = new Set<string>();
  const out: ParsedMeeting[] = [];
  for (const meeting of meetings) {
    const key = `${meeting.day}|${meeting.start}|${meeting.end}|${meeting.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(meeting);
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}
