/** 0 = Monday … 6 = Sunday. Monday-first, the way UW prints a week. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A stretch of a weekday that a person is busy. Minutes are from midnight. */
export interface BusyBlock {
  id: string;
  memberId: string;
  /** e.g. "CSE 142" or "Work shift" */
  label: string;
  location: string | null;
  day: DayIndex;
  start: number;
  end: number;
}

export interface Member {
  id: string;
  name: string;
  /** Index into the member palette, assigned on join. */
  colorIndex: number;
  joinedAt: string;
  /** True once this person has imported or entered a schedule. */
  hasSchedule: boolean;
}

export interface Group {
  code: string;
  name: string;
  createdAt: string;
  members: Member[];
  blocks: BusyBlock[];
}

/** One meeting recovered from a paste or an .ics file, before it is saved. */
export interface ParsedMeeting {
  label: string;
  location: string | null;
  day: DayIndex;
  start: number;
  end: number;
}

export interface ParseResult {
  meetings: ParsedMeeting[];
  /** Lines the parser recognised as a class but could not place on the week. */
  skipped: string[];
}
