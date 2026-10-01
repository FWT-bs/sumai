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

/**
 * UW classes are scheduled in Pacific time, so that is the clock the week is
 * read on. Anchoring here rather than to the importer's own timezone means the
 * same file gives the same week whether it is opened in Seattle or on a laptop
 * still set to Eastern, and means everyone in a group sees the same hours.
 */
const UW_TIME_ZONE = "America/Los_Angeles";

const WEEKDAY_INDEX: Record<string, DayIndex> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function zoneParts(zone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<
    string,
    string
  >;
}

/** How far `zone` runs ahead of UTC at a given instant, in minutes. */
function zoneOffset(zone: string, instant: Date): number {
  const p = zoneParts(zone, instant);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return (asIfUtc - instant.getTime()) / 60000;
}

/** The instant at which `zone`'s wall clock reads the given date and time. */
function instantFromWallTime(
  zone: string,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // The offset depends on the instant, which depends on the offset; one
  // correction pass settles it either side of a daylight-saving change.
  const first = naive - zoneOffset(zone, new Date(naive)) * 60000;
  return new Date(naive - zoneOffset(zone, new Date(first)) * 60000);
}

function uwWallTime(instant: Date): { day: DayIndex; minutes: number } {
  const p = zoneParts(UW_TIME_ZONE, instant);
  return {
    day: WEEKDAY_INDEX[p.weekday] ?? 0,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

function parseIcsDateTime(property: string, value: string): IcsDateTime | null {
  const hit = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/.exec(value.trim());
  if (!hit) return null;

  const [, y, mo, d, hh, mm] = hit;
  if (hh === undefined) {
    const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return { day: toMondayFirst(at.getUTCDay()), minutes: 0, dateOnly: true };
  }

  const tzid = /TZID=\"?([^\";:]+)/i.exec(property)?.[1];
  const isUtc = value.trim().endsWith("Z");

  // A value already on UW's clock, or one with no zone at all, is wall time.
  if (!isUtc && (!tzid || tzid === UW_TIME_ZONE)) {
    const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return {
      day: toMondayFirst(at.getUTCDay()),
      minutes: Number(hh) * 60 + Number(mm),
      dateOnly: false,
    };
  }

  try {
    const instant = isUtc
      ? new Date(
          Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)),
        )
      : instantFromWallTime(
          tzid as string,
          Number(y),
          Number(mo),
          Number(d),
          Number(hh),
          Number(mm),
        );
    return { ...uwWallTime(instant), dateOnly: false };
  } catch {
    // An unknown TZID makes Intl throw; fall back to reading it as wall time.
    const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return {
      day: toMondayFirst(at.getUTCDay()),
      minutes: Number(hh) * 60 + Number(mm),
      dateOnly: false,
    };
  }
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
