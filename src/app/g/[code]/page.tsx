import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GroupView } from "@/components/group-view";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/code";
import { getGroup } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const code = normalizeJoinCode((await params).code);
  const group = isValidJoinCode(code) ? getGroup(code) : null;
  if (!group) return { title: "Group not found" };
  return {
    title: `${group.name} · Sumai`,
    description: `Shared free time for ${group.name}. Join with code ${group.code}.`,
  };
}

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const raw = (await params).code;
  const code = normalizeJoinCode(raw);
  if (!isValidJoinCode(code)) notFound();
  // Keep one canonical URL, so a code typed in lower case still shares cleanly.
  if (raw !== code) redirect(`/g/${code}`);

  const group = getGroup(code);
  if (!group) notFound();

  return <GroupView initialGroup={group} />;
}
