import { describe, expect, it } from "vitest";
import { parseUwSchedule } from "@/lib/parse-uw";
import { parseDayCodes, parseTimeRange, formatTime } from "@/lib/time";

describe("parseDayCodes", () => {
  it("reads UW compact day specs", () => {
    expect(parseDayCodes("MWF")).toEqual([0, 2, 4]);
    expect(parseDayCodes("TTh")).toEqual([1, 3]);
    expect(parseDayCodes("MTWThF")).toEqual([0, 1, 2, 3, 4]);
    expect(parseDayCodes("Th")).toEqual([3]);
    expect(parseDayCodes("T")).toEqual([1]);
  });

  it("reads long and separated day names", () => {
    expect(parseDayCodes("Monday")).toEqual([0]);
    expect(parseDayCodes("Tue")).toEqual([1]);
    expect(parseDayCodes("TR")).toEqual([1, 3]);
    expect(parseDayCodes("Daily")).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects things that are not day specs", () => {
    for (const token of ["MATH", "CHEM", "AM", "PM", "5.0", "KNE", "ENGL", "A", "241"]) {
      expect(parseDayCodes(token), token).toBeNull();
    }
  });
});

describe("parseTimeRange", () => {
  it("reads explicit meridiems", () => {
    expect(parseTimeRange("10:30 AM - 11:20 AM")).toEqual({ start: 630, end: 680 });
    expect(parseTimeRange("1:30 PM - 2:50 PM")).toEqual({ start: 810, end: 890 });
  });

  it("applies a trailing meridiem to both ends", () => {
    expect(parseTimeRange("2:30-3:20 PM")).toEqual({ start: 870, end: 920 });
    expect(parseTimeRange("11:30 - 1:20 PM")).toEqual({ start: 690, end: 800 });
  });

  it("reads UW compact times", () => {
    expect(parseTimeRange("830-920")).toEqual({ start: 510, end: 560 });
    expect(parseTimeRange("1030-1120")).toEqual({ start: 630, end: 680 });
    expect(parseTimeRange("130-220P")).toEqual({ start: 810, end: 860 });
    expect(parseTimeRange("130-220")).toEqual({ start: 810, end: 860 });
  });

  it("reads 24-hour and en-dash ranges", () => {
    expect(parseTimeRange("13:30–14:50")).toEqual({ start: 810, end: 890 });
  });
});

describe("parseUwSchedule", () => {
  it("reads a MyUW registration table", () => {
    const { meetings } = parseUwSchedule(
      [
        "SLN\tCourse\tSection\tCredits\tDays\tTime\tLocation",
        "12345\tENGL 131\tA\t5.0\tMWF\t10:30 AM - 11:20 AM\tMGH 241",
        "16702\tCSE 143\tA\tTTh\t1:30 PM - 2:50 PM\tKNE 130",
      ].join("\n"),
    );
    expect(meetings).toHaveLength(5);
    const engl = meetings.filter((m) => m.label === "ENGL 131");
    expect(engl.map((m) => m.day)).toEqual([0, 2, 4]);
    expect(engl[0]).toMatchObject({ start: 630, end: 680, location: "MGH 241" });
    const cse = meetings.filter((m) => m.label === "CSE 143");
    expect(cse.map((m) => m.day)).toEqual([1, 3]);
    expect(cse[0]).toMatchObject({ start: 810, end: 890, location: "KNE 130" });
  });

  it("reads Time Schedule rows with compact times and instructors", () => {
    const { meetings } = parseUwSchedule(
      ["12345 A 5 MWF 830-920 KNE 130 Smith,John", "12346 AA QZ Th 930-1020 SAV 137"].join("\n"),
    );
    expect(meetings.filter((m) => m.start === 510)).toHaveLength(3);
    const quiz = meetings.filter((m) => m.start === 570);
    expect(quiz).toHaveLength(1);
    expect(quiz[0].day).toBe(3);
  });

  it("carries the course code and room across a multi-line paste", () => {
    const { meetings } = parseUwSchedule(
      [
        "CSE 142 A",
        "Lecture",
        "MWF 9:30 AM - 10:20 AM",
        "KNE 130",
        "CHEM 142 B",
        "Lecture",
        "TTh 1:30 PM - 2:50 PM",
        "BAG 131",
      ].join("\n"),
    );
    const cse = meetings.filter((m) => m.label === "CSE 142");
    expect(cse).toHaveLength(3);
    expect(cse[0]).toMatchObject({ start: 570, end: 620, location: "KNE 130" });
    const chem = meetings.filter((m) => m.label === "CHEM 142");
    expect(chem).toHaveLength(2);
    expect(chem[0]).toMatchObject({ start: 810, end: 890, location: "BAG 131" });
  });

  it("reads long day names written out", () => {
    const { meetings } = parseUwSchedule("PHYS 121 A Monday, Wednesday, Friday 8:30 - 9:20 AM");
    expect(meetings.map((m) => m.day)).toEqual([0, 2, 4]);
    expect(meetings[0]).toMatchObject({ start: 510, end: 560, label: "PHYS 121" });
  });

  it("keeps two meetings that sit on one line", () => {
    const { meetings } = parseUwSchedule("MATH 124 A MW 8:30-9:20 AM F 9:30-10:20 AM");
    expect(meetings).toHaveLength(3);
    expect(meetings.find((m) => m.day === 4)).toMatchObject({ start: 570, end: 620 });
  });

  it("flags classes with no meeting time instead of dropping them silently", () => {
    const result = parseUwSchedule("GEOG 258 A 5.0 TBA");
    expect(result.meetings).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });

  it("does not mistake a room range for a class time", () => {
    const { meetings } = parseUwSchedule("Meets in MGH 241-243");
    expect(meetings).toHaveLength(0);
  });

  it("drops duplicate rows", () => {
    const { meetings } = parseUwSchedule(
      ["CSE 142 A MWF 9:30 AM - 10:20 AM", "CSE 142 A MWF 9:30 AM - 10:20 AM"].join("\n"),
    );
    expect(meetings).toHaveLength(3);
  });
});

describe("formatTime", () => {
  it("prints minutes from midnight", () => {
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(630)).toBe("10:30 AM");
    expect(formatTime(720)).toBe("12:00 PM");
    expect(formatTime(890)).toBe("2:50 PM");
  });
});
