import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  group_code  TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color_index INTEGER NOT NULL,
  joined_at   TEXT NOT NULL,
  imported_at TEXT
);

CREATE INDEX IF NOT EXISTS members_by_group ON members (group_code);

CREATE TABLE IF NOT EXISTS busy_blocks (
  id        TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  location  TEXT,
  day       INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS blocks_by_member ON busy_blocks (member_id);
`;

type Db = Database.Database;

// Next reloads route modules on every edit in development, so the handle is
// cached on the global to avoid piling up connections to the same file.
const globalForDb = globalThis as unknown as { sumaiDb?: Db };

function open(): Db {
  const configured = process.env.SUMAI_DATA_DIR;
  // The bundler cannot trace a path that comes from the environment, and does
  // not need to: this file is only ever read at runtime on the server.
  const dir = configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "sumai.sqlite"));
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Db {
  if (!globalForDb.sumaiDb) globalForDb.sumaiDb = open();
  return globalForDb.sumaiDb;
}
