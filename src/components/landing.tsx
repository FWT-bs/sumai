"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, TriangleAlert } from "lucide-react";
import { SampleWeek } from "@/components/sample-week";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/client";
import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from "@/lib/code";
import { saveMembership, useMemberships } from "@/lib/session";

const STEPS = [
  {
    title: "Paste your schedule",
    body: "Copy it out of MyUW, MyPlan or the Time Schedule. Day codes like MWF and TTh are read as written.",
  },
  {
    title: "Share the join code",
    body: "Six characters. Everyone who enters it lands in the same week and adds their own classes.",
  },
  {
    title: "Read the overlap",
    body: "Every gap the whole group shares, to the ten minutes UW schedules are built on.",
  },
];

export function Landing() {
  const router = useRouter();
  const recent = useMemberships();

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div
          className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <Wordmark />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8 pb-[max(3rem,env(safe-area-inset-bottom))] sm:py-12">
        <section className="grid items-start gap-8 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="eyebrow">Built for UW schedules</p>
            <div className="flex flex-col gap-3">
              <h1 className="max-w-[22ch] text-[2.125rem] leading-[1.06] font-semibold tracking-[-0.035em] sm:text-5xl">
                Find the hours your group actually shares.
              </h1>
              <p className="max-w-[46ch] text-base text-muted-foreground sm:text-lg">
                Paste everyone&rsquo;s classes, share one join code, and the open windows show up on
                a single week.
              </p>
            </div>
            <EntryCard router={router} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <SampleWeek />
            {recent.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="eyebrow">Your groups</h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {recent.slice(0, 4).map((entry) => (
                    <li key={entry.code}>
                      <Link
                        href={`/g/${entry.code}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {entry.groupName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            as {entry.memberName}
                          </span>
                        </span>
                        <span className="font-mono text-sm tracking-[0.12em] text-muted-foreground tnum">
                          {entry.code}
                        </span>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t pt-8">
          <h2 className="text-base font-semibold">How it goes</h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-1.5">
                <span className="eyebrow tnum text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function EntryCard({ router }: { router: ReturnType<typeof useRouter> }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [startName, setStartName] = React.useState("");
  const [groupName, setGroupName] = React.useState("");

  const [joinCode, setJoinCode] = React.useState("");
  const [joinName, setJoinName] = React.useState("");

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { group, member } = await api.createGroup(
        groupName.trim() || "Study group",
        startName,
      );
      saveMembership(group, member);
      router.push(`/g/${group.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start a group. Try again.");
      setBusy(false);
    }
  };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { group, member } = await api.joinGroup(joinCode, joinName);
      saveMembership(group, member);
      router.push(`/g/${group.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join. Check the code.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <Tabs defaultValue="start" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="start">Start a group</TabsTrigger>
          <TabsTrigger value="join">Join with a code</TabsTrigger>
        </TabsList>

        <TabsContent value="start">
          <form onSubmit={start} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-name">Your name</Label>
              <Input
                id="start-name"
                value={startName}
                onChange={(event) => setStartName(event.target.value)}
                placeholder="First name is enough"
                maxLength={32}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="CSE 143 study group"
                maxLength={48}
              />
            </div>
            <Button type="submit" size="lg" disabled={busy || !startName.trim()}>
              <Sparkles aria-hidden />
              {busy ? "Setting up…" : "Create the group"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="join">
          <form onSubmit={join} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="join-code">Join code</Label>
              <Input
                id="join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
                placeholder="ABC234"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={joinCode.length === JOIN_CODE_LENGTH && !isValidJoinCode(joinCode)}
                className="font-mono text-lg tracking-[0.22em] uppercase tnum"
              />
              {joinCode.length === JOIN_CODE_LENGTH && !isValidJoinCode(joinCode) && (
                <p className="text-xs text-muted-foreground">
                  Codes never use I, L, O, 0 or 1.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="join-your-name">Your name</Label>
              <Input
                id="join-your-name"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="First name is enough"
                maxLength={32}
                required
                autoComplete="given-name"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={busy || !joinName.trim() || !isValidJoinCode(joinCode)}
            >
              {busy ? "Joining…" : "Join the group"}
              <ArrowRight aria-hidden />
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
