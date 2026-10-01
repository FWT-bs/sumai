"use client";

import { CalendarX2, Clock } from "lucide-react";
import type { FreeWindow } from "@/lib/availability";
import type { Member } from "@/lib/types";
import { DAY_NAMES, DAY_SHORT, formatDuration, formatTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SharedWindowsProps {
  windows: FreeWindow[];
  relaxed: boolean;
  members: Member[];
  selectedCount: number;
  minMinutes: number;
  awaitingImports: number;
}

const VISIBLE = 7;

export function SharedWindows({
  windows,
  relaxed,
  members,
  selectedCount,
  minMinutes,
  awaitingImports,
}: SharedWindowsProps) {
  const nameOf = new Map(members.map((member) => [member.id, member.name]));
  const longest = windows.reduce((best, window) => Math.max(best, window.end - window.start), 0);
  // Windows arrive ranked, so the first one is the answer and gets to be read
  // without working down a list.
  const [best, ...rest] = windows;
  const shown = rest.slice(0, VISIBLE);
  const missing = (window: FreeWindow) =>
    window.busyIds.map((id) => nameOf.get(id) ?? "someone").join(", ");

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">
          {relaxed ? "Almost everyone" : "Everyone is free"}
        </h2>
        {windows.length > 0 && (
          <p className="text-sm text-muted-foreground tnum">
            {windows.length} {windows.length === 1 ? "window" : "windows"} &middot; longest{" "}
            {formatDuration(longest)}
          </p>
        )}
      </div>

      {selectedCount === 0 ? (
        <Empty
          icon={<CalendarX2 className="size-5" />}
          title="Nobody is selected"
          body="Switch someone on above to see shared time."
        />
      ) : windows.length === 0 ? (
        <Empty
          icon={<CalendarX2 className="size-5" />}
          title={`No gap of ${formatDuration(minMinutes)} or more`}
          body={
            awaitingImports > 0
              ? `${awaitingImports} ${awaitingImports === 1 ? "person has" : "people have"} not imported a schedule yet, so this may change.`
              : "Try a shorter minimum, or take someone out of the filter."
          }
        />
      ) : (
        <>
          {relaxed && (
            <p className="text-sm text-muted-foreground">
              Nothing works for all {selectedCount}. These are the windows one person short.
            </p>
          )}

          <div className="rounded-xl border border-primary/25 bg-primary/[0.055] p-4 sm:p-5">
            <p className="eyebrow text-primary">Best time this week</p>
            <p className="mt-1.5 text-xl font-semibold tracking-[-0.025em] tnum sm:text-[1.625rem]">
              {DAY_NAMES[best.day]} {formatTime(best.start)}
              <span className="text-muted-foreground"> &ndash; </span>
              {formatTime(best.end)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tnum">{formatDuration(best.end - best.start)}</span>
              {" · "}
              {best.busyIds.length
                ? `everyone except ${missing(best)}`
                : `all ${selectedCount} free`}
            </p>
          </div>

          {shown.length > 0 && <h3 className="eyebrow pt-1">Also open</h3>}
          {shown.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {shown.map((window) => (
              <li
                key={`${window.day}-${window.start}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-[0.6875rem] font-semibold text-primary"
                >
                  {DAY_SHORT[window.day]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium tnum">
                    {formatTime(window.start)} &ndash; {formatTime(window.end)}
                  </p>
                  {window.busyIds.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      without {missing(window)}
                    </p>
                  )}
                </div>
                <Badge
                  variant={window.busyIds.length ? "outline" : "gold"}
                  className="shrink-0 tnum"
                >
                  <Clock aria-hidden />
                  {formatDuration(window.end - window.start)}
                </Badge>
              </li>
            ))}
          </ul>
          )}
          {rest.length > VISIBLE && (
            <p className="text-xs text-muted-foreground">
              {rest.length - VISIBLE} shorter{" "}
              {rest.length - VISIBLE === 1 ? "window" : "windows"} not listed. The grid below
              shows all of them.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Empty({
  icon,
  title,
  body,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-xl border border-dashed bg-card/40 px-4 py-6",
        className,
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
