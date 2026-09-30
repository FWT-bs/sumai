"use client";

import * as React from "react";
import type { Group, Member } from "./types";

const KEY = "sumai.groups.v1";

export interface SavedMembership {
  code: string;
  groupName: string;
  memberId: string;
  memberName: string;
  lastOpened: string;
}

const EMPTY: SavedMembership[] = [];

/** Every read and write is guarded: private windows and blocked site data both
 *  make localStorage throw, and the app has to keep working without it. */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): SavedMembership[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const entries = parsed.filter(
      (entry): entry is SavedMembership =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedMembership).code === "string" &&
        typeof (entry as SavedMembership).memberId === "string",
    );
    return entries.sort((a, b) => b.lastOpened.localeCompare(a.lastOpened));
  } catch {
    return EMPTY;
  }
}

// useSyncExternalStore re-reads on every render and bails out only when the
// snapshot is referentially equal, so the parsed list is cached against the raw
// string it came from.
let cachedRaw: string | null = null;
let cachedValue: SavedMembership[] = EMPTY;
let primed = false;

function snapshot(): SavedMembership[] {
  const raw = readRaw();
  if (!primed || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
    primed = true;
  }
  return cachedValue;
}

function serverSnapshot(): SavedMembership[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key counts as a change here too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeAll(entries: SavedMembership[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 12)));
  } catch {
    /* Nothing to do — the app falls back to asking who you are. */
  }
  primed = false;
  for (const listener of listeners) listener();
}

export function listMemberships(): SavedMembership[] {
  return snapshot();
}

export function getMembership(code: string): SavedMembership | null {
  return snapshot().find((entry) => entry.code === code) ?? null;
}

export function saveMembership(group: Group, member: Member): void {
  const entry: SavedMembership = {
    code: group.code,
    groupName: group.name,
    memberId: member.id,
    memberName: member.name,
    lastOpened: new Date().toISOString(),
  };
  writeAll([entry, ...snapshot().filter((existing) => existing.code !== group.code)]);
}

export function touchMembership(code: string, patch: Partial<SavedMembership> = {}): void {
  const all = [...snapshot()];
  const index = all.findIndex((entry) => entry.code === code);
  if (index === -1) return;
  all[index] = { ...all[index], ...patch, lastOpened: new Date().toISOString() };
  writeAll(all);
}

export function forgetMembership(code: string): void {
  writeAll(snapshot().filter((entry) => entry.code !== code));
}

/** The saved memberships, kept in step with other tabs. */
export function useMemberships(): SavedMembership[] {
  return React.useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useMembership(code: string): SavedMembership | null {
  const all = useMemberships();
  return React.useMemo(() => all.find((entry) => entry.code === code) ?? null, [all, code]);
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;
const noopSubscribe = () => () => {};

/** False during the server render and the first client render, true after.
 *  Guards anything that can only be known from the browser. */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}
