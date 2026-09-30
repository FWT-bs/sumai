import { describe, expect, it } from "vitest";
import { buildGrid, findBestWindows, findWindows, freeCountAt } from "@/lib/availability";
import { parseIcsSchedule } from "@/lib/parse-ics";
import type { BusyBlock, DayIndex } from "@/lib/types";

let counter = 0;
function block(memberId: string, day: DayIndex, start: number, end: number): BusyBlock {
  counter += 1;
  return { id: `b${counter}`, memberId, label: "Class", location: null, day, start, end };
}

const WEEKDAYS: DayIndex[] = [0, 1, 2, 3, 4];

describe("buildGrid", () => {
  it("marks every slot a class touches and no slot past its end", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 570, 620)], // 9:30–10:20
      memberIds: ["a"],
      days: [0],
      dayStart: 9 * 60,
      dayEnd: 11 * 60,
    });
    expect(grid.slotCount).toBe(12);
    expect(grid.busyBy[0][2]).toEqual([]); // 9:20 slot, before the class
    expect(grid.busyBy[0][3]).toEqual(["a"]); // 9:30
    expect(grid.busyBy[0][7]).toEqual(["a"]); // 10:10, last busy slot
    expect(grid.busyBy[0][8]).toEqual([]); // 10:20, class is over
  });

  it("ignores members outside the filter", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 600, 660), block("b", 0, 600, 660)],
      memberIds: ["a"],
      days: [0],
      dayStart: 600,
      dayEnd: 660,
    });
    expect(freeCountAt(grid, 0, 0)).toBe(0);
    expect(grid.busyBy[0][0]).toEqual(["a"]);
  });
});

describe("findWindows", () => {
  const blocks = [
    block("a", 0, 510, 560), // Mon 8:30–9:20
    block("b", 0, 570, 620), // Mon 9:30–10:20
    block("a", 1, 480, 1260), // Tue booked solid
    block("b", 1, 480, 1260),
  ];

  it("finds the stretch where everyone is free", () => {
    const grid = buildGrid({
      blocks,
      memberIds: ["a", "b"],
      days: WEEKDAYS,
      dayStart: 8 * 60,
      dayEnd: 21 * 60,
    });
    const windows = findWindows(grid, { minMinutes: 30 });
    const monday = windows.filter((w) => w.day === 0);
    // 8:00 is open until a's 8:30 class; then the two classes run back to
    // back until 10:20, and the rest of the day is clear.
    expect(monday.map((w) => [w.start, w.end]).sort((x, y) => x[0] - y[0])).toEqual([
      [480, 510],
      [620, 1260],
    ]);
    expect(windows.some((w) => w.day === 1)).toBe(false);
    expect(windows.filter((w) => w.day === 2)).toHaveLength(1);
  });

  it("respects the minimum length", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 480, 600), block("a", 0, 620, 1260)],
      memberIds: ["a"],
      days: [0],
      dayStart: 8 * 60,
      dayEnd: 21 * 60,
    });
    expect(findWindows(grid, { minMinutes: 30 })).toHaveLength(0);
    expect(findWindows(grid, { minMinutes: 20 })).toHaveLength(1);
  });

  it("does not merge across a change in who is free", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 480, 600)],
      memberIds: ["a", "b"],
      days: [0],
      dayStart: 8 * 60,
      dayEnd: 12 * 60,
    });
    const windows = findWindows(grid, { minMinutes: 30, maxMissing: 1 });
    expect(windows).toHaveLength(2);
    expect(windows[0].busyIds).toEqual([]);
    expect(windows[0]).toMatchObject({ start: 600, end: 720 });
    expect(windows[1].busyIds).toEqual(["a"]);
    expect(windows[1]).toMatchObject({ start: 480, end: 600 });
  });
});

describe("findBestWindows", () => {
  it("falls back to one-person-short windows when nobody shares a gap", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 480, 720), block("b", 0, 720, 960)],
      memberIds: ["a", "b"],
      days: [0],
      dayStart: 8 * 60,
      dayEnd: 16 * 60,
    });
    const { windows, relaxed } = findBestWindows(grid, 30);
    expect(relaxed).toBe(true);
    expect(windows).toHaveLength(2);
    expect(windows.every((w) => w.busyIds.length === 1)).toBe(true);
  });

  it("prefers exact windows when they exist", () => {
    const grid = buildGrid({
      blocks: [block("a", 0, 480, 600)],
      memberIds: ["a", "b"],
      days: [0],
      dayStart: 8 * 60,
      dayEnd: 12 * 60,
    });
    const { windows, relaxed } = findBestWindows(grid, 30);
    expect(relaxed).toBe(false);
    expect(windows).toHaveLength(1);
    expect(windows[0].busyIds).toEqual([]);
  });
});

describe("parseIcsSchedule", () => {
  it("expands a weekly recurring class over its BYDAY list", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:CSE 143 A",
      "LOCATION:KNE 130",
      "DTSTART;TZID=America/Los_Angeles:20260105T093000",
      "DTEND;TZID=America/Los_Angeles:20260105T102000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260320T000000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const { meetings } = parseIcsSchedule(ics);
    expect(meetings).toHaveLength(3);
    expect(meetings.map((m) => m.day)).toEqual([0, 2, 4]);
    expect(meetings[0]).toMatchObject({
      label: "CSE 143 A",
      location: "KNE 130",
      start: 570,
      end: 620,
    });
  });

  it("uses the start weekday for a one-off event and unfolds long lines", () => {
    const ics = [
      "BEGIN:VEVENT",
      "SUMMARY:CHEM 142 Exam review with a very long",
      "  title that folds",
      "DTSTART;TZID=America/Los_Angeles:20260108T160000",
      "DTEND;TZID=America/Los_Angeles:20260108T173000",
      "END:VEVENT",
    ].join("\r\n");
    const { meetings } = parseIcsSchedule(ics);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ day: 3, start: 960, end: 1050 });
    expect(meetings[0].label).toContain("title that folds");
  });

  it("flags all-day events rather than blocking the whole week", () => {
    const ics = ["BEGIN:VEVENT", "SUMMARY:Holiday", "DTSTART;VALUE=DATE:20260119", "END:VEVENT"].join(
      "\r\n",
    );
    const result = parseIcsSchedule(ics);
    expect(result.meetings).toHaveLength(0);
    expect(result.skipped).toEqual(["Holiday"]);
  });
});
