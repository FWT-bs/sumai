"use client";

import * as React from "react";
import { buildGrid, findBestWindows } from "@/lib/availability";
import { DAY_INITIAL, formatDuration, formatTime } from "@/lib/time";
import { heatColor } from "@/lib/heat";
import type { BusyBlock, DayIndex } from "@/lib/types";

/** Three plausible UW weeks, so the landing page shows the real output of the
 *  tool rather than an empty frame. Made up, and labelled as an example. */
const PEOPLE = ["Maya", "Dev", "Priya"];

/** `days` is a run of day indexes, so "024" means Monday, Wednesday, Friday. */
function week(memberId: string, entries: Array<[string, string, number, number]>): BusyBlock[] {
  return entries.flatMap(([label, days, start, end]) =>
    [...days].map((digit) => ({
      id: `${memberId}-${label}-${digit}`,
      memberId,
      label,
      location: null,
      day: Number(digit) as DayIndex,
      start,
      end,
    })),
  );
}

const BLOCKS: BusyBlock[] = [
  ...week("m", [
    ["CHEM 142", "024", 510, 560],
    ["ENGL 131", "13", 600, 680],
    ["MATH 124", "024", 750, 800],
  ]),
  ...week("d", [
    ["CSE 142", "024", 570, 620],
    ["CSE 143", "13", 810, 890],
    ["Work", "2", 870, 1020],
  ]),
  ...week("p", [
    ["BIOL 180", "024", 630, 680],
    ["PSYCH 101", "13", 510, 590],
    ["HIST 111", "024", 810, 860],
  ]),
];

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];
const START = 8 * 60;
const END = 17 * 60;

export function SampleWeek() {
  const grid = React.useMemo(
    () =>
      buildGrid({
        blocks: BLOCKS,
        memberIds: ["m", "d", "p"],
        days: DAYS,
        dayStart: START,
        dayEnd: END,
      }),
    [],
  );
  const best = React.useMemo(() => findBestWindows(grid, 60).windows[0], [grid]);

  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Example &mdash; three schedules</span>
        <span className="text-xs text-muted-foreground tnum">
          {PEOPLE.join(", ")}
        </span>
      </figcaption>

      <div className="flex gap-[3px]" aria-hidden>
        {grid.days.map((day, dayPosition) => (
          <div key={day} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-center text-[0.625rem] font-semibold text-muted-foreground">
              {DAY_INITIAL[day]}
            </span>
            <div className="overflow-hidden rounded-[4px]">
              {Array.from({ length: grid.slotCount }, (_, slot) => {
                const free = 3 - grid.busyBy[dayPosition][slot].length;
                return (
                  <div
                    key={slot}
                    style={{ height: "6px", background: heatColor(free, 3) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {best && (
        <p className="text-sm text-muted-foreground">
          Longest window all three share:{" "}
          <span className="font-medium text-foreground tnum">
            {["Mon", "Tue", "Wed", "Thu", "Fri"][best.day]} {formatTime(best.start)}&ndash;
            {formatTime(best.end)}
          </span>{" "}
          <span className="tnum">({formatDuration(best.end - best.start)})</span>
        </p>
      )}
    </figure>
  );
}
