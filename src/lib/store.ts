import { getDb } from "./db";
import { MEMBER_PALETTE_SIZE, generateJoinCode, newId } from "./code";
import type { BusyBlock, DayIndex, Group, Member, ParsedMeeting } from "./types";

interface GroupRow {
  code: string;
  name: string;
  created_at: string;
}

interface MemberRow {
  id: string;
  group_code: string;
  name: string;
  color_index: number;
  joined_at: string;
  imported_at: string | null;
}

interface BlockRow {
  id: string;
  member_id: string;
  label: string;
  location: string | null;
  day: number;
  start_min: number;
  end_min: number;
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    colorIndex: row.color_index,
    joinedAt: row.joined_at,
    hasSchedule: row.imported_at !== null,
  };
}

function toBlock(row: BlockRow): BusyBlock {
  return {
    id: row.id,
    memberId: row.member_id,
    label: row.label,
    location: row.location,
    day: row.day as DayIndex,
    start: row.start_min,
    end: row.end_min,
  };
}

export function createGroup(name: string): Group {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO groups (code, name, created_at) VALUES (?, ?, ?)",
  );

  // Collisions are vanishingly rare at 31^6, but a retry costs nothing.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode();
    const createdAt = new Date().toISOString();
    try {
      insert.run(code, name, createdAt);
      return { code, name, createdAt, members: [], blocks: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("UNIQUE")) throw error;
    }
  }
  throw new Error("Could not allocate a join code. Try again.");
}

export function getGroup(code: string): Group | null {
  const db = getDb();
  const group = db.prepare("SELECT * FROM groups WHERE code = ?").get(code) as
    | GroupRow
    | undefined;
  if (!group) return null;

  const members = db
    .prepare("SELECT * FROM members WHERE group_code = ? ORDER BY joined_at, name")
    .all(code) as MemberRow[];

  const blocks = members.length
    ? (db
        .prepare(
          `SELECT b.* FROM busy_blocks b
             JOIN members m ON m.id = b.member_id
            WHERE m.group_code = ?
            ORDER BY b.day, b.start_min`,
        )
        .all(code) as BlockRow[])
    : [];

  return {
    code: group.code,
    name: group.name,
    createdAt: group.created_at,
    members: members.map(toMember),
    blocks: blocks.map(toBlock),
  };
}

export function groupExists(code: string): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM groups WHERE code = ?").get(code));
}

export function addMember(code: string, name: string): Member {
  const db = getDb();
  if (!groupExists(code)) throw new NotFoundError("That join code does not match a group.");

  const taken = db
    .prepare("SELECT color_index FROM members WHERE group_code = ?")
    .all(code) as Array<{ color_index: number }>;
  const used = new Set(taken.map((row) => row.color_index));
  let colorIndex = 0;
  while (colorIndex < MEMBER_PALETTE_SIZE && used.has(colorIndex)) colorIndex += 1;
  if (colorIndex === MEMBER_PALETTE_SIZE) colorIndex = taken.length % MEMBER_PALETTE_SIZE;

  const member: MemberRow = {
    id: newId("mem"),
    group_code: code,
    name,
    color_index: colorIndex,
    joined_at: new Date().toISOString(),
    imported_at: null,
  };
  db.prepare(
    `INSERT INTO members (id, group_code, name, color_index, joined_at, imported_at)
     VALUES (@id, @group_code, @name, @color_index, @joined_at, @imported_at)`,
  ).run(member);
  return toMember(member);
}

export function findMemberGroup(memberId: string): string | null {
  const row = getDb()
    .prepare("SELECT group_code FROM members WHERE id = ?")
    .get(memberId) as { group_code: string } | undefined;
  return row?.group_code ?? null;
}

export function renameMember(memberId: string, name: string): void {
  const result = getDb().prepare("UPDATE members SET name = ? WHERE id = ?").run(name, memberId);
  if (result.changes === 0) throw new NotFoundError("That member is no longer in the group.");
}

export function removeMember(memberId: string): void {
  const result = getDb().prepare("DELETE FROM members WHERE id = ?").run(memberId);
  if (result.changes === 0) throw new NotFoundError("That member is no longer in the group.");
}

/** Replaces a member's whole week. Importing again is always a clean overwrite. */
export function setSchedule(memberId: string, meetings: ParsedMeeting[]): void {
  const db = getDb();
  if (!findMemberGroup(memberId)) {
    throw new NotFoundError("That member is no longer in the group.");
  }

  const clear = db.prepare("DELETE FROM busy_blocks WHERE member_id = ?");
  const insert = db.prepare(
    `INSERT INTO busy_blocks (id, member_id, label, location, day, start_min, end_min)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const mark = db.prepare("UPDATE members SET imported_at = ? WHERE id = ?");

  db.transaction(() => {
    clear.run(memberId);
    for (const meeting of meetings) {
      insert.run(
        newId("blk"),
        memberId,
        meeting.label,
        meeting.location,
        meeting.day,
        meeting.start,
        meeting.end,
      );
    }
    mark.run(new Date().toISOString(), memberId);
  })();
}

export class NotFoundError extends Error {}
