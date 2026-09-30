import type { Group, Member, ParsedMeeting } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : "Something went wrong. Try again.";
    throw new Error(message);
  }
  return body as T;
}

export function createGroup(groupName: string, memberName: string) {
  return request<{ group: Group; member: Member }>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ groupName, memberName }),
  });
}

export function joinGroup(code: string, name: string) {
  return request<{ group: Group; member: Member }>(
    `/api/groups/${encodeURIComponent(code)}/members`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function fetchGroup(code: string) {
  return request<{ group: Group }>(`/api/groups/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
}

export function saveSchedule(memberId: string, meetings: ParsedMeeting[]) {
  return request<{ group: Group }>(`/api/members/${encodeURIComponent(memberId)}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ meetings }),
  });
}

export function renameMember(memberId: string, name: string) {
  return request<{ group: Group }>(`/api/members/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function leaveGroup(memberId: string) {
  return request<{ group: Group }>(`/api/members/${encodeURIComponent(memberId)}`, {
    method: "DELETE",
  });
}
