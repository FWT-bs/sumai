import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJson } from "@/lib/api-response";
import { findMemberGroup, getGroup, setSchedule } from "@/lib/store";
import { cleanMeetings } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replaces a member's week. Re-importing is always a clean overwrite. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const code = findMemberGroup(id);
    if (!code) return jsonError("That member is no longer in the group.", 404);

    setSchedule(id, cleanMeetings((await readJson(request)).meetings));
    return NextResponse.json({ group: getGroup(code) });
  } catch (error) {
    return handleRouteError(error);
  }
}
