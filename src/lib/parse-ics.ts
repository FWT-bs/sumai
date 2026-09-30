import type { DayIndex, ParsedMeeting, ParseResult } from "./types";
import { dedupe } from "./parse-uw";

/**
 * Reads a calendar export (MyPlan, Google Calendar, Outlook) into weekly
 * meetings. A class shows up as one weekly recurring event, so BYDAY carries
 * the days; a one-off event falls back to the weekday its start lands on.
 */

const BYDAY_TO_INDEX: Record<string, DayIndex> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

/** ICS folds long lines by starting the continuation with a space or tab. */
function unfold(input: string): string[] {
  const raw = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

interface IcsDateTime {
  /** Monday-first weekday index. */
  day: DayIndex;
  /** Minutes from midnight, local wall time. */
  minutes: number;
  dateOnly: boolean;
}

function parseIcsDateTime(property: string, value: string): IcsDateTime | null {
  const utc = value.endsWith("Z");
  const hit = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/.exec(value.trim());
  if (!hit) return null;

  const [, y, mo, d, hh, mm] = hit;
  if (hh === undefined) {
    const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return { day: toMondayFirst(at.getUTCDay()), minutes: 0, dateOnly: true };
  }

  // A UTC value has to be moved into the reader's zone before its weekday and
  // clock time mean anything. A floating or TZID value is already wall time.
  if (utc && !/TZID=/i.test(property)) {
    const at = new Date(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), 0),
    );
    return {
      day: toMondayFirst(at.getDay()),
      minutes: at.getHours() * 60 + at.getMinutes(),
      dateOnly: false,
    };
  }

  const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return {
    day: toMondayFirst(at.getUTCDay()),
    minutes: Number(hh) * 60 + Number(mm),
    dateOnly: false,
  };
}

function toMondayFirst(jsDay: number): DayIndex {
  return ((jsDay + 6) % 7) as DayIndex;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIcsSchedule(input: string): ParseResult {
  const lines = unfold(input);
  const meetings: ParsedMeeting[] = [];
  const skipped: string[] = [];

  let inEvent = false;
  let summary = "";
  let location = "";
  let start: IcsDateTime | null = null;
  let end: IcsDateTime | null = null;
  let byDay: DayIndex[] = [];

  const reset = () => {
    summary = "";
    location = "";
    start = null;
    end = null;
    byDay = [];
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      reset();
      continue;
    }
    if (!inEvent) continue;

    if (upper.startsWith("END:VEVENT")) {
      inEvent = false;
      const label = summary || "Class";
      if (!start || !end || start.dateOnly) {
        skipped.push(label);
        continue;
      }
      const days = byDay.length ? byDay : [start.day];
      if (end.minutes <= start.minutes) {
        skipped.push(label);
        continue;
      }
      for (const day of days) {
        meetings.push({
          label,
          location: location || null,
          day,
          start: start.minutes,
          end: end.minutes,
        });
      }
      continue;
    }

    const split = line.indexOf(":");
    if (split === -1) continue;
    const property = line.slice(0, split);
    const value = line.slice(split + 1);
    const name = property.split(";")[0].toUpperCase();

    if (name === "SUMMARY") summary = unescapeText(value);
    else if (name === "LOCATION") location = unescapeText(value);
    else if (name === "DTSTART") start = parseIcsDateTime(property, value);
    else if (name === "DTEND") end = parseIcsDateTime(property, value);
    else if (name === "RRULE") {
      const days = /BYDAY=([^;]+)/i.exec(value);
      if (days) {
        byDay = days[1]
          .split(",")
          // BYDAY entries may carry an ordinal, as in "2FR".
          .map((token) => BYDAY_TO_INDEX[token.trim().toUpperCase().slice(-2)])
          .filter((day): day is DayIndex => day !== undefined);
      }
    }
  }

  return { meetings: dedupe(meetings), skipped: [...new Set(skipped)] };
}
