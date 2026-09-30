import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-response";
import { readJson } from "@/lib/api-response";
import { findMemberGroup, getGroup, removeMember, renameMember } from "@/lib/store";
import { cleanName } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const code = findMemberGroup(id);
    if (!code) return jsonError("That member is no longer in the group.", 404);

    renameMember(id, cleanName((await readJson(request)).name));
    return NextResponse.json({ group: getGroup(code) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const code = findMemberGroup(id);
    if (!code) return jsonError("That member is no longer in the group.", 404);

    removeMember(id);
    return NextResponse.json({ group: getGroup(code) });
  } catch (error) {
    return handleRouteError(error);
  }
}
