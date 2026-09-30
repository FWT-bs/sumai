"use client";

import { Check, CircleAlert } from "lucide-react";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MemberFilterProps {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  meId: string | null;
}

/**
 * Picks who the overlap is calculated for. Anyone switched off drops out of
 * the grid and the shared-window list, so a subgroup can plan on its own.
 */
export function MemberFilter({ members, selectedIds, onChange, meId }: MemberFilterProps) {
  const selected = new Set(selectedIds);
  const withSchedule = members.filter((member) => member.hasSchedule);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">Who to include</h2>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => onChange(members.map((member) => member.id))}
            className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
          >
            Everyone
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={() => onChange(withSchedule.map((member) => member.id))}
            className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
            disabled={withSchedule.length === members.length}
          >
            Only imported
          </button>
          {meId && (
            <>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => onChange([meId])}
                className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
              >
                Just me
              </button>
            </>
          )}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {members.map((member) => {
          const on = selected.has(member.id);
          const color = `var(--member-${member.colorIndex % 8})`;
          return (
            <button
              key={member.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(member.id)}
              className={cn(
                "group flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-sm font-medium transition-colors",
                on
                  ? "border-transparent bg-card shadow-xs"
                  : "border-dashed bg-transparent text-muted-foreground",
              )}
              style={on ? { borderColor: color, color } : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-4 place-items-center rounded-full border-2 transition-colors",
                  on ? "border-transparent" : "border-current",
                )}
                style={on ? { background: color } : undefined}
              >
                {on && <Check className="size-2.5 stroke-[3.5] text-card" />}
              </span>
              <span className="whitespace-nowrap">
                {member.name}
                {member.id === meId && <span className="font-normal opacity-60"> (you)</span>}
              </span>
              {!member.hasSchedule && (
                <CircleAlert
                  className="size-3.5 shrink-0 text-gold"
                  aria-label="No schedule imported yet"
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
