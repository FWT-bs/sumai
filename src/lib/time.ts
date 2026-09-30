import type { DayIndex } from "./types";

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_INITIAL = ["M", "T", "W", "Th", "F", "S", "Su"] as const;

/** Resolution the availability engine works at. UW classes start and end on
 *  tens of minutes (8:30–9:20, 10:00–11:20), so ten minutes is lossless. */
export const SLOT_MINUTES = 10;

export const DEFAULT_DAY_START = 8 * 60;
export const DEFAULT_DAY_END = 21 * 60;

/** Minutes from midnight → "9:30 AM". */
export function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/**
 * Label for the hour axis. The meridiem is spelled out only where it changes —
 * at the top of the axis and at noon — so the column stays one line wide on a
 * phone.
 */
export function formatAxisHour(minutes: number, withMeridiem: boolean): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (m !== 0) return `${h12}:${String(m).padStart(2, "0")}`;
  return withMeridiem ? `${h12} ${h24 < 12 ? "AM" : "PM"}` : String(h12);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hr" : `${h} hrs`;
  return `${h} hr ${m} min`;
}

/** "9:30 AM" / "0930" / "14:05" → minutes from midnight, or null. */
export function parseClockTime(raw: string, meridiem?: "AM" | "PM"): number | null {
  const text = raw.trim().toUpperCase();
  const own = /(AM|PM|[AP]\.M\.|[AP])\s*$/.exec(text);
  let mark = meridiem;
  if (own) mark = own[1].startsWith("A") ? "AM" : "PM";

  const digits = text.replace(/(AM|PM|[AP]\.M\.|[AP])\s*$/, "").trim();
  let hour: number;
  let minute: number;

  const colon = /^(\d{1,2}):(\d{2})$/.exec(digits);
  if (colon) {
    hour = Number(colon[1]);
    minute = Number(colon[2]);
  } else if (/^\d{3,4}$/.test(digits)) {
    hour = Number(digits.slice(0, digits.length - 2));
    minute = Number(digits.slice(-2));
  } else if (/^\d{1,2}$/.test(digits)) {
    hour = Number(digits);
    minute = 0;
  } else {
    return null;
  }

  if (minute > 59 || hour > 24) return null;

  if (mark === "AM") hour = hour === 12 ? 0 : hour;
  else if (mark === "PM") hour = hour === 12 ? 12 : hour + 12;
  // No meridiem: UW compact listings only run 7 AM–10 PM, so an hour of
  // 1–6 can only mean the afternoon.
  else if (hour >= 1 && hour <= 6) hour += 12;

  if (hour > 23) return null;
  return hour * 60 + minute;
}

export interface TimeRange {
  start: number;
  end: number;
}

/** "10:30 AM - 11:20 AM", "1030-1120", "130-220P", "13:30–14:50" → a range. */
export function parseTimeRange(raw: string): TimeRange | null {
  const text = raw.replace(/[‐-―−]/g, "-").trim();
  const parts = text.split(/\s*(?:-|to)\s*/i);
  if (parts.length !== 2) return null;

  const tail = /(AM|PM|[AP]\.M\.|[AP])\s*$/i.exec(parts[1]);
  const shared = tail ? (tail[1].toUpperCase().startsWith("A") ? "AM" : "PM") : undefined;

  const end = parseClockTime(parts[1]);
  // Give the start the end's meridiem only when it carries none of its own.
  const startHasOwn = /(AM|PM|[AP]\.M\.|[AP])\s*$/i.test(parts[0]);
  let start = parseClockTime(parts[0], startHasOwn ? undefined : shared);

  if (start === null || end === null) return null;

  // "11:30 - 1:20 PM" — the shared PM pushed the start past the end.
  if (start >= end && !startHasOwn && shared === "PM" && start - 720 >= 0) {
    start -= 720;
  }
  if (start >= end) return null;
  return { start, end };
}

// Longest spelling first within each day, and Sunday/Thursday ahead of the
// single letters they share a prefix with, so "Su" never reads as Saturday and
// "Th" never reads as Tuesday.
const DAY_TOKEN_MAP: Array<[RegExp, DayIndex]> = [
  [/^(SUNDAY|SUN|SU)/, 6],
  [/^(SATURDAY|SAT|SA|S)/, 5],
  [/^(THURSDAY|THURS|THUR|THU|TH|R)/, 3],
  [/^(TUESDAY|TUES|TUE|TU|T)/, 1],
  [/^(MONDAY|MON|M)/, 0],
  [/^(WEDNESDAY|WED|W)/, 2],
  [/^(FRIDAY|FRI|F)/, 4],
];

/**
 * "MWF" → [Mon, Wed, Fri]; "TTh" → [Tue, Thu]; "Mon/Wed" → [Mon, Wed].
 * Returns null when the token is not a day spec at all, which is how callers
 * tell "F" (Friday) apart from a stray letter.
 */
export function parseDayCodes(raw: string): DayIndex[] | null {
  const text = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (!text) return null;
  if (text === "DAILY") return [0, 1, 2, 3, 4];
  if (text === "WEEKENDS") return [5, 6];

  const found: DayIndex[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let matched = false;
    for (const [pattern, day] of DAY_TOKEN_MAP) {
      const hit = pattern.exec(rest);
      if (!hit) continue;
      if (!found.includes(day)) found.push(day);
      i += hit[0].length;
      matched = true;
      break;
    }
    if (!matched) return null;
  }
  if (!found.length) return null;
  return found.sort((a, b) => a - b);
}

export function clampToDay(value: number): number {
  return Math.max(0, Math.min(1440, value));
}

export function floorToSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

export function ceilToSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}
