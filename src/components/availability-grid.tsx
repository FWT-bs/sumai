"use client";

import * as React from "react";
import type { AvailabilityGrid, FreeWindow } from "@/lib/availability";
import { findWindows, slotStartMinutes } from "@/lib/availability";
import type { BusyBlock, Member } from "@/lib/types";
import { DAY_INITIAL, DAY_NAMES, DAY_SHORT, SLOT_MINUTES, formatAxisHour, formatTime } from "@/lib/time";
import { heatColor } from "@/lib/heat";
import { cn } from "@/lib/utils";

interface AvailabilityGridProps {
  grid: AvailabilityGrid;
  members: Member[];
  blocks: BusyBlock[];
  /** Outlined on the week, so the headline window can be found in context. */
  highlight?: FreeWindow;
}

export function AvailabilityGrid({
  grid,
  members,
  blocks,
  highlight,
}: AvailabilityGridProps) {
  const [focus, setFocus] = React.useState<{ dayPosition: number; slot: number } | null>(null);
  const total = grid.memberIds.length;
  const nameOf = React.useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members],
  );

  const hours = React.useMemo(() => {
    const out: number[] = [];
    for (let minute = grid.dayStart; minute < grid.dayEnd; minute += 60) out.push(minute);
    return out;
  }, [grid.dayStart, grid.dayEnd]);
  const slotsPerHour = 60 / SLOT_MINUTES;

  /** One sentence per day, so the grid is reachable without seeing the colors. */
  const daySummaries = React.useMemo(() => {
    const windows = findWindows(grid, { minMinutes: 30, maxMissing: 0 });
    return grid.days.map((day) => {
      const forDay = windows.filter((window) => window.day === day);
      if (!forDay.length) return `${DAY_NAMES[day]}: no shared 30-minute gap.`;
      const listed = forDay
        .slice(0, 4)
        .map((window) => `${formatTime(window.start)} to ${formatTime(window.end)}`)
        .join(", ");
      return `${DAY_NAMES[day]}: everyone free ${listed}${forDay.length > 4 ? ", and more" : ""}.`;
    });
  }, [grid]);

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    setFocus({
      dayPosition: Number(cell.dataset.dayPosition),
      slot: Number(cell.dataset.slotIndex),
    });
  };

  const detail = React.useMemo(() => {
    if (!focus) return null;
    const day = grid.days[focus.dayPosition];
    if (day === undefined) return null;
    const busyIds = grid.busyBy[focus.dayPosition][focus.slot] ?? [];
    const start = slotStartMinutes(grid, focus.slot);
    const reasons = busyIds.map((id) => {
      const block = blocks.find(
        (candidate) =>
          candidate.memberId === id &&
          candidate.day === day &&
          candidate.start <= start &&
          candidate.end > start,
      );
      return `${nameOf.get(id) ?? "Someone"}${block ? ` (${block.label})` : ""}`;
    });
    return {
      day,
      start,
      end: start + SLOT_MINUTES,
      free: total - busyIds.length,
      reasons,
    };
  }, [focus, grid, blocks, nameOf, total]);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">The week</h2>
        <Legend />
      </header>

      <div className="rounded-xl border bg-card p-2 sm:p-3">
        <div
          className="flex [--slot-h:7px] sm:[--slot-h:9px]"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setFocus(null)}
        >
          {/* Hour axis */}
          <div className="w-9 shrink-0 sm:w-11">
            <div className="h-6" />
            {hours.map((minute, index) => (
              <div
                key={minute}
                className="eyebrow tnum pr-1.5 text-right leading-none whitespace-nowrap"
                style={{ height: `calc(var(--slot-h) * ${slotsPerHour})` }}
              >
                <span className="relative -top-[0.3em]">
                  {formatAxisHour(minute, index === 0 || minute % 720 === 0)}
                </span>
              </div>
            ))}
          </div>

          {grid.days.map((day, dayPosition) => (
            <div
              key={day}
              tabIndex={0}
              aria-label={daySummaries[dayPosition]}
              className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="flex h-6 items-center justify-center">
                <span className="text-[0.6875rem] font-semibold text-muted-foreground sm:hidden">
                  {DAY_INITIAL[day]}
                </span>
                <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
                  {DAY_SHORT[day]}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-[5px]">
                {highlight?.day === day && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 rounded-[4px] ring-2 ring-inset ring-gold"
                    style={{
                      top: `calc(var(--slot-h) * ${(highlight.start - grid.dayStart) / SLOT_MINUTES})`,
                      height: `calc(var(--slot-h) * ${(highlight.end - highlight.start) / SLOT_MINUTES})`,
                    }}
                  />
                )}
                {Array.from({ length: grid.slotCount }, (_, slot) => {
                  const busy = grid.busyBy[dayPosition][slot];
                  const free = total - busy.length;
                  const onHour = slot % slotsPerHour === 0;
                  const isFocused =
                    focus?.dayPosition === dayPosition && focus?.slot === slot;
                  return (
                    <div
                      key={slot}
                      data-cell
                      data-day-position={dayPosition}
                      data-slot-index={slot}
                      aria-hidden
                      className={cn(
                        "border-x-[0.5px] border-card",
                        onHour && slot !== 0 && "border-t-[0.5px] border-t-heat-gridline",
                        isFocused && "ring-1 ring-inset ring-foreground/45",
                      )}
                      style={{
                        height: "var(--slot-h)",
                        background: heatColor(free, total),
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p
        aria-live="polite"
        className="min-h-9 text-sm text-muted-foreground"
      >
        {detail ? (
          <span>
            <span className="font-medium text-foreground tnum">
              {DAY_SHORT[detail.day]} {formatTime(detail.start)}
            </span>{" "}
            &middot;{" "}
            <span className={detail.free === total && total > 0 ? "text-primary font-medium" : ""}>
              {detail.free} of {total} free
            </span>
            {detail.reasons.length > 0 && (
              <>
                {" "}
                &middot; in class: {detail.reasons.join(", ")}
              </>
            )}
          </span>
        ) : highlight ? (
          <span>
            <span className="font-medium text-gold">Outlined:</span> the best time this week.
            Tap or hover any block to see who is in class then.
          </span>
        ) : (
          <span>Tap or hover any block to see who is in class then.</span>
        )}
      </p>
    </section>
  );
}

function Legend() {
  // A fixed four-person sample, so the ramp reads the same whether the filter
  // holds one person or nine.
  const sample = 4;
  const steps = [0, 1, 2, 3, 4];
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">None free</span>
      <span className="flex overflow-hidden rounded-sm border">
        {steps.map((free) => (
          <span
            key={free}
            className="block size-3.5"
            style={{ background: heatColor(free, sample) }}
          />
        ))}
      </span>
      <span className="eyebrow">All free</span>
    </div>
  );
}
