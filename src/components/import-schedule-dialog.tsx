"use client";

import * as React from "react";
import { ClipboardPaste, Calendar, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parseUwSchedule } from "@/lib/parse-uw";
import { parseIcsSchedule } from "@/lib/parse-ics";
import { DAY_INITIAL, DAY_SHORT, formatTime } from "@/lib/time";
import type { BusyBlock, DayIndex, ParsedMeeting } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLE_PASTE = `ENGL 131  A  5.0  MWF  10:30 AM - 11:20 AM  MGH 241
CSE 143   A  5.0  TTh  1:30 PM - 2:50 PM   KNE 130
CSE 143   AA QZ   Th   9:30 AM - 10:20 AM  SAV 137
CHEM 142  B  5.0  MWF  8:30 - 9:20 AM      BAG 131`;

const PLACEHOLDER = `Paste straight from MyUW, MyPlan or the Time Schedule, for example:

ENGL 131  A  5.0  MWF  10:30 AM - 11:20 AM  MGH 241
CSE 143   A  5.0  TTh  1:30 PM - 2:50 PM    KNE 130`;

interface ImportScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  existing: BusyBlock[];
  onSave: (meetings: ParsedMeeting[]) => Promise<void>;
}

function timeValueToMinutes(value: string): number | null {
  const hit = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!hit) return null;
  const minutes = Number(hit[1]) * 60 + Number(hit[2]);
  return minutes >= 0 && minutes <= 1440 ? minutes : null;
}

function sortMeetings(meetings: ParsedMeeting[]): ParsedMeeting[] {
  return [...meetings].sort((a, b) => a.day - b.day || a.start - b.start);
}

export function ImportScheduleDialog({
  open,
  onOpenChange,
  memberName,
  existing,
  onSave,
}: ImportScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="import-help">
        <DialogHeader>
          <DialogTitle>{memberName}&rsquo;s week</DialogTitle>
          <DialogDescription id="import-help">
            Everything here counts as busy. Saving replaces your whole week.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every visit starts from the saved week. */}
        {open && <Editor existing={existing} onSave={onSave} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({
  existing,
  onSave,
  onClose,
}: {
  existing: BusyBlock[];
  onSave: (meetings: ParsedMeeting[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState<ParsedMeeting[]>(() =>
    sortMeetings(
      existing.map((block) => ({
        label: block.label,
        location: block.location,
        day: block.day,
        start: block.start,
        end: block.end,
      })),
    ),
  );
  const [paste, setPaste] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Manual entry
  const [manualLabel, setManualLabel] = React.useState("");
  const [manualDays, setManualDays] = React.useState<DayIndex[]>([]);
  const [manualStart, setManualStart] = React.useState("14:30");
  const [manualEnd, setManualEnd] = React.useState("15:20");

  const addMeetings = (meetings: ParsedMeeting[], skipped: string[], source: string) => {
    if (!meetings.length) {
      setNotice(null);
      setError(
        skipped.length
          ? `Found ${skipped.length} ${skipped.length === 1 ? "class" : "classes"} with no meeting time. Add ${skipped.length === 1 ? "it" : "them"} by hand if ${skipped.length === 1 ? "it" : "they"} meet${skipped.length === 1 ? "s" : ""}.`
          : `Nothing in that ${source} looked like a class meeting. Check that the days and times came along with it.`,
      );
      return;
    }

    setDraft((current) => {
      const seen = new Set(
        current.map((meeting) => `${meeting.day}|${meeting.start}|${meeting.end}|${meeting.label}`),
      );
      const added = meetings.filter(
        (meeting) => !seen.has(`${meeting.day}|${meeting.start}|${meeting.end}|${meeting.label}`),
      );
      return sortMeetings([...current, ...added]);
    });

    setError(null);
    setNotice(
      `Added ${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"}.` +
        (skipped.length
          ? ` ${skipped.length} with no time ${skipped.length === 1 ? "was" : "were"} left out.`
          : ""),
    );
  };

  const handlePaste = () => {
    const { meetings, skipped } = parseUwSchedule(paste);
    addMeetings(meetings, skipped, "paste");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { meetings, skipped } = parseIcsSchedule(text);
      addMeetings(meetings, skipped, "file");
    } catch {
      setError("That file could not be read. Export it again as .ics and retry.");
    }
  };

  const handleManualAdd = () => {
    const start = timeValueToMinutes(manualStart);
    const end = timeValueToMinutes(manualEnd);
    if (!manualDays.length) {
      setError("Pick at least one day.");
      return;
    }
    if (start === null || end === null || end <= start) {
      setError("Set an end time that comes after the start time.");
      return;
    }
    addMeetings(
      manualDays.map((day) => ({
        label: manualLabel.trim() || "Busy",
        location: null,
        day,
        start,
        end,
      })),
      [],
      "entry",
    );
    setManualLabel("");
    setManualDays([]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const grouped = React.useMemo(() => {
    const byDay = new Map<DayIndex, ParsedMeeting[]>();
    for (const meeting of draft) {
      const list = byDay.get(meeting.day) ?? [];
      list.push(meeting);
      byDay.set(meeting.day, list);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [draft]);

  return (
    <>
      <div className="-mx-5 flex-1 overflow-y-auto px-5 sm:-mx-6 sm:px-6">
          <Tabs defaultValue="paste" className="flex flex-col gap-3">
            <TabsList>
              <TabsTrigger value="paste">
                <ClipboardPaste aria-hidden />
                Paste
              </TabsTrigger>
              <TabsTrigger value="file">
                <Calendar aria-hidden />
                File
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Pencil aria-hidden />
                By hand
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="flex flex-col gap-2.5">
              <Textarea
                id="schedule-paste"
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                placeholder={PLACEHOLDER}
                rows={6}
                className="font-mono text-[0.8125rem] leading-relaxed"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handlePaste} disabled={!paste.trim()}>
                  Read this paste
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPaste(EXAMPLE_PASTE)}>
                  Use a sample schedule
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="file" className="flex flex-col gap-2.5">
              <Label htmlFor="schedule-file">Calendar export (.ics)</Label>
              <Input
                id="schedule-file"
                type="file"
                accept=".ics,text/calendar"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-sm file:font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Weekly repeating events become weekly busy blocks. All-day events are left out.
              </p>
            </TabsContent>

            <TabsContent value="manual" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-label">What is it</Label>
                <Input
                  id="manual-label"
                  value={manualLabel}
                  onChange={(event) => setManualLabel(event.target.value)}
                  placeholder="CSE 143, work shift, practice"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Days</span>
                <div className="flex gap-1.5">
                  {DAY_INITIAL.map((initial, index) => {
                    const day = index as DayIndex;
                    const on = manualDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        aria-label={DAY_SHORT[day]}
                        onClick={() =>
                          setManualDays((current) =>
                            current.includes(day)
                              ? current.filter((value) => value !== day)
                              : [...current, day],
                          )
                        }
                        className={cn(
                          "h-10 flex-1 rounded-md border text-sm font-medium transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:bg-muted",
                        )}
                      >
                        {initial}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor="manual-start">Starts</Label>
                  <Input
                    id="manual-start"
                    type="time"
                    value={manualStart}
                    onChange={(event) => setManualStart(event.target.value)}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor="manual-end">Ends</Label>
                  <Input
                    id="manual-end"
                    type="time"
                    value={manualEnd}
                    onChange={(event) => setManualEnd(event.target.value)}
                  />
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleManualAdd} className="self-start">
                <Plus aria-hidden />
                Add to my week
              </Button>
            </TabsContent>
          </Tabs>

          {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}
          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">
                Your week{" "}
                <span className="font-normal text-muted-foreground tnum">
                  ({draft.length} {draft.length === 1 ? "meeting" : "meetings"})
                </span>
              </h3>
              {draft.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
                  Clear all
                </Button>
              )}
            </div>

            {draft.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                Nothing yet. An empty week means you are free the whole time.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {grouped.map(([day, meetings]) => (
                  <li key={day} className="flex gap-3">
                    <Badge variant="secondary" className="mt-0.5 h-fit shrink-0">
                      {DAY_SHORT[day]}
                    </Badge>
                    <ul className="min-w-0 flex-1 divide-y">
                      {meetings.map((meeting) => (
                        <li
                          key={`${meeting.start}-${meeting.end}-${meeting.label}`}
                          className="flex items-center gap-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{meeting.label}</p>
                            <p className="truncate text-xs text-muted-foreground tnum">
                              {formatTime(meeting.start)} &ndash; {formatTime(meeting.end)}
                              {meeting.location ? ` · ${meeting.location}` : ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${meeting.label} on ${DAY_SHORT[day]}`}
                            onClick={() =>
                              setDraft((current) => current.filter((value) => value !== meeting))
                            }
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save my week"}
        </Button>
      </DialogFooter>
    </>
  );
}
