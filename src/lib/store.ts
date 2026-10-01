import { read, write, type GroupRecord, type MemberRecord } from "./db";
import { MEMBER_PALETTE_SIZE, generateJoinCode, newId } from "./code";
import type { BusyBlock, Group, Member, ParsedMeeting } from "./types";

export class NotFoundError extends Error {}

function toMember(member: MemberRecord): Member {
  return {
    id: member.id,
    name: member.name,
    colorIndex: member.colorIndex,
    joinedAt: member.joinedAt,
    hasSchedule: member.importedAt !== null,
  };
}

function toBlocks(member: MemberRecord): BusyBlock[] {
  return member.blocks.map((block) => ({
    id: block.id,
    memberId: member.id,
    label: block.label,
    location: block.location,
    day: block.day,
    start: block.start,
    end: block.end,
  }));
}

function toGroup(group: GroupRecord): Group {
  const members = [...group.members].sort(
    (a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.name.localeCompare(b.name),
  );
  return {
    code: group.code,
    name: group.name,
    createdAt: group.createdAt,
    members: members.map(toMember),
    blocks: members
      .flatMap(toBlocks)
      .sort((a, b) => a.day - b.day || a.start - b.start),
  };
}

function findGroup(groups: GroupRecord[], code: string): GroupRecord | undefined {
  return groups.find((group) => group.code === code);
}

function locateMember(
  groups: GroupRecord[],
  memberId: string,
): { group: GroupRecord; member: MemberRecord } | null {
  for (const group of groups) {
    const member = group.members.find((candidate) => candidate.id === memberId);
    if (member) return { group, member };
  }
  return null;
}

export function createGroup(name: string): Group {
  return write((store) => {
    let code = generateJoinCode();
    // Collisions are vanishingly rare at 31^6, but a retry costs nothing.
    for (let attempt = 0; attempt < 8 && findGroup(store.groups, code); attempt += 1) {
      code = generateJoinCode();
    }
    if (findGroup(store.groups, code)) {
      throw new Error("Could not allocate a join code. Try again.");
    }

    const group: GroupRecord = {
      code,
      name,
      createdAt: new Date().toISOString(),
      members: [],
    };
    store.groups.push(group);
    return toGroup(group);
  });
}

export function getGroup(code: string): Group | null {
  const group = findGroup(read().groups, code);
  return group ? toGroup(group) : null;
}

export function groupExists(code: string): boolean {
  return Boolean(findGroup(read().groups, code));
}

export function addMember(code: string, name: string): Member {
  return write((store) => {
    const group = findGroup(store.groups, code);
    if (!group) throw new NotFoundError("That join code does not match a group.");

    const used = new Set(group.members.map((member) => member.colorIndex));
    let colorIndex = 0;
    while (colorIndex < MEMBER_PALETTE_SIZE && used.has(colorIndex)) colorIndex += 1;
    if (colorIndex === MEMBER_PALETTE_SIZE) {
      colorIndex = group.members.length % MEMBER_PALETTE_SIZE;
    }

    const member: MemberRecord = {
      id: newId("mem"),
      name,
      colorIndex,
      joinedAt: new Date().toISOString(),
      importedAt: null,
      blocks: [],
    };
    group.members.push(member);
    return toMember(member);
  });
}

export function findMemberGroup(memberId: string): string | null {
  const found = locateMember(read().groups, memberId);
  return found ? found.group.code : null;
}

export function renameMember(memberId: string, name: string): void {
  write((store) => {
    const found = locateMember(store.groups, memberId);
    if (!found) throw new NotFoundError("That member is no longer in the group.");
    found.member.name = name;
  });
}

export function removeMember(memberId: string): void {
  write((store) => {
    const found = locateMember(store.groups, memberId);
    if (!found) throw new NotFoundError("That member is no longer in the group.");
    found.group.members = found.group.members.filter(
      (member) => member.id !== memberId,
    );
  });
}

/** Replaces a member's whole week. Importing again is always a clean overwrite. */
export function setSchedule(memberId: string, meetings: ParsedMeeting[]): void {
  write((store) => {
    const found = locateMember(store.groups, memberId);
    if (!found) throw new NotFoundError("That member is no longer in the group.");

    found.member.blocks = meetings.map((meeting) => ({
      id: newId("blk"),
      label: meeting.label,
      location: meeting.location,
      day: meeting.day,
      start: meeting.start,
      end: meeting.end,
    }));
    found.member.importedAt = new Date().toISOString();
  });
}
