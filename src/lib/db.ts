import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DayIndex } from "./types";

/**
 * Persistence is a single JSON file, written atomically.
 *
 * A group is a handful of people and a few hundred busy blocks, so the whole
 * store is a few kilobytes and fits in memory. Keeping it to the Node standard
 * library means no native module to compile, which means no build toolchain to
 * install before the app will run.
 */

export interface BlockRecord {
  id: string;
  label: string;
  location: string | null;
  day: DayIndex;
  start: number;
  end: number;
}

export interface MemberRecord {
  id: string;
  name: string;
  colorIndex: number;
  joinedAt: string;
  /** Null until this person saves a week, which is how a group tells
   *  "no classes" apart from "has not got round to it". */
  importedAt: string | null;
  blocks: BlockRecord[];
}

export interface GroupRecord {
  code: string;
  name: string;
  createdAt: string;
  members: MemberRecord[];
}

export interface Store {
  version: 1;
  groups: GroupRecord[];
}

/**
 * The app runs on the reader's own machine, so a filesystem problem is
 * something they can fix — but only if they are told which folder failed and
 * why. A bare "something went wrong" sends people hunting through a terminal.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly directory: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

function describe(error: unknown, directory: string): StorageError {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const where = `Sumai stores its groups in ${directory}`;

  switch (code) {
    case "EACCES":
    case "EPERM":
      return new StorageError(
        `${where}, and does not have permission to write there. On macOS, folders like Downloads, Desktop and Documents need to be granted to your terminal in System Settings → Privacy & Security → Files and Folders. Moving the project to your home folder also works, or set SUMAI_DATA_DIR to a folder you can write to.`,
        directory,
      );
    case "ENOSPC":
      return new StorageError(`${where}, and the disk is full.`, directory);
    case "EROFS":
      return new StorageError(`${where}, and that drive is read-only.`, directory);
    case "ENOTDIR":
      return new StorageError(
        `${where}, but part of that path is a file rather than a folder. Remove it, or set SUMAI_DATA_DIR to somewhere else.`,
        directory,
      );
    default:
      return new StorageError(
        `${where}, and writing there failed${code ? ` (${code})` : ""}. The terminal running the app has the full error.`,
        directory,
      );
  }
}

function emptyStore(): Store {
  return { version: 1, groups: [] };
}

function dataFile(): string {
  const configured = process.env.SUMAI_DATA_DIR;
  // The bundler cannot trace a path that comes from the environment, and does
  // not need to: this file is only ever read at runtime on the server.
  const dir = configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.join(process.cwd(), "data");
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw describe(error, dir);
  }
  return path.join(dir, "sumai.json");
}

function isStore(value: unknown): value is Store {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Store).groups)
  );
}

function load(file: string): Store {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return emptyStore();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) throw new Error("unrecognised shape");
    return parsed;
  } catch (error) {
    // Never quietly discard someone's groups: keep the unreadable file so it
    // can be inspected, and carry on with an empty store.
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      renameSync(file, backup);
      console.error(`[sumai] ${file} was unreadable; moved it to ${backup}`, error);
    } catch {
      console.error(`[sumai] ${file} was unreadable and could not be set aside`, error);
    }
    return emptyStore();
  }
}

// Next reloads route modules on every edit in development, so the loaded store
// is cached on the global rather than re-read on each request.
const globalForStore = globalThis as unknown as {
  sumaiStore?: Store;
  sumaiFile?: string;
};

function handle(): { store: Store; file: string } {
  if (!globalForStore.sumaiFile) globalForStore.sumaiFile = dataFile();
  const file = globalForStore.sumaiFile;
  if (!globalForStore.sumaiStore) globalForStore.sumaiStore = load(file);
  return { store: globalForStore.sumaiStore, file };
}

/** Reads the store. Callers must not mutate what they get back. */
export function read(): Store {
  return handle().store;
}

/**
 * Applies a change and writes it out before returning, so a response is never
 * sent for something that is not yet on disk. Writing to a temporary file and
 * renaming it means a crash mid-write leaves the previous file intact.
 */
export function write<T>(change: (store: Store) => T): T {
  const { store, file } = handle();
  const result = change(store);

  const temporary = `${file}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(store, null, 2), "utf8");
    renameSync(temporary, file);
  } catch (error) {
    throw describe(error, path.dirname(file));
  }
  return result;
}
