"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, LogOut, RefreshCw, UserPlus } from "lucide-react";
import { AvailabilityGrid } from "@/components/availability-grid";
import { ImportScheduleDialog } from "@/components/import-schedule-dialog";
import { JoinCode } from "@/components/join-code";
import { MemberFilter } from "@/components/member-filter";
import { SharedWindows } from "@/components/shared-windows";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { buildGrid, findBestWindows } from "@/lib/availability";
import * as api from "@/lib/client";
import {
  forgetMembership,
  saveMembership,
  touchMembership,
  useHydrated,
  useMembership,
} from "@/lib/session";
import {
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  formatDuration,
} from "@/lib/time";
import type { DayIndex, Group } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS: DayIndex[] = [0, 1, 2, 3, 4];
const FULL_WEEK: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
const MIN_LENGTH_OPTIONS = [30, 60, 90];
const POLL_MS = 15_000;

export function GroupView({ initialGroup }: { initialGroup: Group }) {
  const [group, setGroup] = React.useState(initialGroup);
  const [selectedIds, setSelectedIds] = React.useState<string[]>(
    initialGroup.members.map((member) => member.id),
  );
  const [minMinutes, setMinMinutes] = React.useState(60);
  const [showWeekend, setShowWeekend] = React.useState(
    initialGroup.blocks.some((block) => block.day >= 5),
  );
  const [importOpen, setImportOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Who this browser is in the group. Unknown until hydration, because it is
  // stored in the browser and never rendered on the server.
  const resolved = useHydrated();
  const membership = useMembership(group.code);
  const me = membership
    ? (group.members.find((member) => member.id === membership.memberId) ?? null)
    : null;

  // Drop a saved membership once the person is no longer in the group, and
  // otherwise bump it to the top of the recent list. Touching rewrites the
  // stored record, which feeds back into `membership`, so it happens once per
  // group rather than on every change.
  const touched = React.useRef<string | null>(null);
  const staleMembership = Boolean(membership) && !me;
  React.useEffect(() => {
    if (!resolved || !membership) return;
    if (staleMembership) {
      forgetMembership(group.code);
      return;
    }
    if (touched.current === group.code) return;
    touched.current = group.code;
    touchMembership(group.code, { groupName: group.name });
  }, [resolved, membership, staleMembership, group.code, group.name]);

  const applyGroup = React.useCallback((next: Group) => {
    setGroup(next);
    setSelectedIds((current) => {
      const live = new Set(next.members.map((member) => member.id));
      const kept = current.filter((id) => live.has(id));
      const added = next.members
        .filter((member) => !current.includes(member.id))
        .map((member) => member.id);
      // New arrivals count by default; nobody has to remember to switch them on.
      return [...kept, ...added];
    });
    if (next.blocks.some((block) => block.day >= 5)) setShowWeekend(true);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const { group: next } = await api.fetchGroup(initialGroup.code);
      applyGroup(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the group.");
    }
  }, [initialGroup.code, applyGroup]);

  // Keeps everyone's view current as the rest of the group imports.
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const days = showWeekend ? FULL_WEEK : WEEKDAYS;

  // Widen the visible day past 8 AM–9 PM only when someone actually has a
  // class out there.
  const { dayStart, dayEnd } = React.useMemo(() => {
    let start = DEFAULT_DAY_START;
    let end = DEFAULT_DAY_END;
    for (const block of group.blocks) {
      if (!days.includes(block.day)) continue;
      start = Math.min(start, Math.floor(block.start / 60) * 60);
      end = Math.max(end, Math.ceil(block.end / 60) * 60);
    }
    return { dayStart: start, dayEnd: end };
  }, [group.blocks, days]);

  const grid = React.useMemo(
    () =>
      buildGrid({
        blocks: group.blocks,
        memberIds: group.members
          .filter((member) => selectedIds.includes(member.id))
          .map((member) => member.id),
        days,
        dayStart,
        dayEnd,
      }),
    [group.blocks, group.members, selectedIds, days, dayStart, dayEnd],
  );

  const { windows, relaxed } = React.useMemo(
    () => findBestWindows(grid, minMinutes),
    [grid, minMinutes],
  );

  const awaitingImports = group.members.filter(
    (member) => selectedIds.includes(member.id) && !member.hasSchedule,
  ).length;

  const handleSaveSchedule = async (meetings: Parameters<typeof api.saveSchedule>[1]) => {
    if (!me) throw new Error("Join the group before saving a schedule.");
    const { group: next } = await api.saveSchedule(me.id, meetings);
    applyGroup(next);
  };

  const handleLeave = async () => {
    if (!me) return;
    setBusy(true);
    try {
      const { group: next } = await api.leaveGroup(me.id);
      forgetMembership(group.code);
      applyGroup(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave the group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5"
          style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
        >
          <Link href="/" className="rounded-md" aria-label="Sumai home">
            <Wordmark />
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {group.name}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void refresh()}
            aria-label="Refresh the group"
            className="text-muted-foreground"
          >
            <RefreshCw />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {group.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground tnum">
                {group.members.length} {group.members.length === 1 ? "person" : "people"}
                {awaitingImports > 0 && ` · ${awaitingImports} still to import`}
              </p>
            </div>
            {me && (
              <Button onClick={() => setImportOpen(true)}>
                <CalendarPlus aria-hidden />
                {me.hasSchedule ? "Edit my week" : "Add my classes"}
              </Button>
            )}
          </div>

          {resolved && !me && <JoinPanel group={group} onJoined={applyGroup} />}
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {group.members.length > 0 && (
          <>
            <MemberFilter
              members={group.members}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              meId={me?.id ?? null}
            />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">At least</span>
                <div className="flex overflow-hidden rounded-md border">
                  {MIN_LENGTH_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={minMinutes === option}
                      onClick={() => setMinMinutes(option)}
                      className={cn(
                        "px-2.5 py-1.5 text-sm font-medium tnum transition-colors",
                        minMinutes === option
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {formatDuration(option)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-weekend"
                  checked={showWeekend}
                  onCheckedChange={setShowWeekend}
                />
                <Label htmlFor="show-weekend">Weekends</Label>
              </div>
            </div>

            <SharedWindows
              windows={windows}
              relaxed={relaxed}
              members={group.members}
              selectedCount={selectedIds.length}
              minMinutes={minMinutes}
              awaitingImports={awaitingImports}
            />

            <AvailabilityGrid
              grid={grid}
              members={group.members}
              blocks={group.blocks}
              highlight={windows[0]}
            />
          </>
        )}

        <JoinCode code={group.code} />

        {me && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm">
            <span className="text-muted-foreground">
              You are in as <span className="font-medium text-foreground">{me.name}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleLeave()}
              disabled={busy}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut aria-hidden />
              Leave group
            </Button>
          </footer>
        )}
      </main>

      {me && (
        <ImportScheduleDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          memberName={me.name}
          existing={group.blocks.filter((block) => block.memberId === me.id)}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
}

function JoinPanel({ group, onJoined }: { group: Group; onJoined: (group: Group) => void }) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { group: next, member } = await api.joinGroup(group.code, name);
      // Saving the membership is what makes this browser "me" in the group;
      // the view picks it up from the store.
      saveMembership(next, member);
      onJoined(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="join-name">Your name</Label>
        <Input
          id="join-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="First name is enough"
          maxLength={32}
          required
          autoComplete="given-name"
        />
      </div>
      <Button type="submit" disabled={busy || !name.trim()} className="sm:w-auto">
        <UserPlus aria-hidden />
        {busy ? "Joining…" : "Join this group"}
      </Button>
      {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
    </form>
  );
}
