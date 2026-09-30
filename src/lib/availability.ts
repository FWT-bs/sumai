import type { BusyBlock, DayIndex } from "./types";
import { SLOT_MINUTES, ceilToSlot, floorToSlot } from "./time";

export interface AvailabilityGrid {
  days: DayIndex[];
  dayStart: number;
  dayEnd: number;
  slotCount: number;
  /** memberIds the grid was built for, in display order. */
  memberIds: string[];
  /** cells[dayPosition][slotIndex] = memberIds busy in that slot. */
  busyBy: string[][][];
}

export interface FreeWindow {
  day: DayIndex;
  start: number;
  end: number;
  /** Everyone in the filter who is free for the whole window. */
  freeIds: string[];
  /** Everyone in the filter who is not. */
  busyIds: string[];
}

export interface BuildGridOptions {
  blocks: BusyBlock[];
  memberIds: string[];
  days: DayIndex[];
  dayStart: number;
  dayEnd: number;
}

export function buildGrid({
  blocks,
  memberIds,
  days,
  dayStart,
  dayEnd,
}: BuildGridOptions): AvailabilityGrid {
  const from = floorToSlot(dayStart);
  const to = ceilToSlot(dayEnd);
  const slotCount = Math.max(0, (to - from) / SLOT_MINUTES);
  const included = new Set(memberIds);

  const busyBy: string[][][] = days.map(() =>
    Array.from({ length: slotCount }, () => [] as string[]),
  );
  const dayPosition = new Map(days.map((day, index) => [day, index]));

  for (const block of blocks) {
    if (!included.has(block.memberId)) continue;
    const position = dayPosition.get(block.day);
    if (position === undefined) continue;

    // A 9:30–10:20 class fills the slots that start at 9:30 through 10:10.
    const firstSlot = Math.max(0, Math.floor((block.start - from) / SLOT_MINUTES));
    const lastSlot = Math.min(slotCount - 1, Math.ceil((block.end - from) / SLOT_MINUTES) - 1);
    for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
      const cell = busyBy[position][slot];
      if (!cell.includes(block.memberId)) cell.push(block.memberId);
    }
  }

  return { days, dayStart: from, dayEnd: to, slotCount, memberIds, busyBy };
}

export function slotStartMinutes(grid: AvailabilityGrid, slot: number): number {
  return grid.dayStart + slot * SLOT_MINUTES;
}

export function freeCountAt(grid: AvailabilityGrid, dayPosition: number, slot: number): number {
  return grid.memberIds.length - grid.busyBy[dayPosition][slot].length;
}

export interface FindWindowsOptions {
  /** Shortest window worth reporting. */
  minMinutes?: number;
  /** How many people in the filter may be busy. 0 means everyone is free. */
  maxMissing?: number;
}

/**
 * Merges runs of slots that share the same set of free people into windows.
 * Splitting on the set rather than the count means a window never silently
 * swaps who it is talking about halfway through.
 */
export function findWindows(
  grid: AvailabilityGrid,
  { minMinutes = 30, maxMissing = 0 }: FindWindowsOptions = {},
): FreeWindow[] {
  const windows: FreeWindow[] = [];
  const total = grid.memberIds.length;
  if (!total) return windows;

  grid.days.forEach((day, position) => {
    let runStart = -1;
    let signature = "";

    const close = (endSlot: number) => {
      if (runStart === -1) return;
      const start = slotStartMinutes(grid, runStart);
      const end = slotStartMinutes(grid, endSlot);
      if (end - start >= minMinutes) {
        const busyIds = signature ? signature.split("\u0000") : [];
        windows.push({
          day,
          start,
          end,
          freeIds: grid.memberIds.filter((id) => !busyIds.includes(id)),
          busyIds,
        });
      }
      runStart = -1;
      signature = "";
    };

    for (let slot = 0; slot < grid.slotCount; slot += 1) {
      const busy = grid.busyBy[position][slot];
      const eligible = busy.length <= maxMissing && total - busy.length > 0;
      const key = eligible
        ? grid.memberIds.filter((id) => busy.includes(id)).join("\u0000")
        : null;

      if (key === null) {
        close(slot);
        continue;
      }
      if (runStart === -1) {
        runStart = slot;
        signature = key;
      } else if (key !== signature) {
        close(slot);
        runStart = slot;
        signature = key;
      }
    }
    close(grid.slotCount);
  });

  return windows.sort(
    (a, b) =>
      a.busyIds.length - b.busyIds.length ||
      b.end - b.start - (a.end - a.start) ||
      a.day - b.day ||
      a.start - b.start,
  );
}

/**
 * Windows where everyone in the filter is free. When there are none, widens to
 * windows one person short so the group still has something to work with.
 */
export function findBestWindows(
  grid: AvailabilityGrid,
  minMinutes = 30,
): { windows: FreeWindow[]; relaxed: boolean } {
  const exact = findWindows(grid, { minMinutes, maxMissing: 0 });
  if (exact.length || grid.memberIds.length < 2) return { windows: exact, relaxed: false };
  const relaxed = findWindows(grid, { minMinutes, maxMissing: 1 }).filter(
    (window) => window.busyIds.length === 1,
  );
  return { windows: relaxed, relaxed: relaxed.length > 0 };
}

export function totalFreeMinutes(windows: FreeWindow[]): number {
  return windows.reduce((sum, window) => sum + (window.end - window.start), 0);
}

export function blocksForMemberDay(
  blocks: BusyBlock[],
  memberId: string,
  day: DayIndex,
): BusyBlock[] {
  return blocks
    .filter((block) => block.memberId === memberId && block.day === day)
    .sort((a, b) => a.start - b.start);
}
