import type { DayIndex, ParsedMeeting } from "./types";

export const MAX_NAME_LENGTH = 32;
export const MAX_GROUP_NAME_LENGTH = 48;
export const MAX_MEETINGS = 200;
export const MAX_LABEL_LENGTH = 48;
export const MAX_LOCATION_LENGTH = 32;

export class ValidationError extends Error {}

export function cleanName(input: unknown, max = MAX_NAME_LENGTH): string {
  if (typeof input !== "string") throw new ValidationError("Enter a name.");
  const name = input.replace(/\s+/g, " ").trim().slice(0, max);
  if (!name) throw new ValidationError("Enter a name.");
  return name;
}

function cleanLabel(input: unknown): string {
  if (typeof input !== "string") return "Class";
  const label = input.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH);
  return label || "Class";
}

function cleanLocation(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const location = input.replace(/\s+/g, " ").trim().slice(0, MAX_LOCATION_LENGTH);
  return location || null;
}

export function cleanMeetings(input: unknown): ParsedMeeting[] {
  if (!Array.isArray(input)) throw new ValidationError("Send a list of meetings.");
  if (input.length > MAX_MEETINGS) {
    throw new ValidationError(`A week can hold at most ${MAX_MEETINGS} meetings.`);
  }

  return input.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError(`Meeting ${index + 1} is not readable.`);
    }
    const value = raw as Record<string, unknown>;
    const day = Number(value.day);
    const start = Math.round(Number(value.start));
    const end = Math.round(Number(value.end));

    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new ValidationError(`Meeting ${index + 1} has no weekday.`);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440) {
      throw new ValidationError(`Meeting ${index + 1} falls outside the day.`);
    }
    if (end <= start) {
      throw new ValidationError(`Meeting ${index + 1} ends before it starts.`);
    }

    return {
      label: cleanLabel(value.label),
      location: cleanLocation(value.location),
      day: day as DayIndex,
      start,
      end,
    };
  });
}
