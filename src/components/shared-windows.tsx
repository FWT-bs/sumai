"use client";

import { CalendarX2, Clock } from "lucide-react";
import type { FreeWindow } from "@/lib/availability";
import type { Member } from "@/lib/types";
import { DAY_SHORT, formatDuration, formatTime } from "@/lib/time";
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

const VISIBLE = 8;

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
  const shown = windows.slice(0, VISIBLE);

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
                      without {window.busyIds.map((id) => nameOf.get(id) ?? "someone").join(", ")}
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
          {windows.length > VISIBLE && (
            <p className="text-xs text-muted-foreground">
              {windows.length - VISIBLE} shorter {windows.length - VISIBLE === 1 ? "window" : "windows"} not
              listed. The grid below shows all of them.
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
