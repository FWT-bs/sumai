import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJson } from "@/lib/api-response";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/code";
import { addMember, getGroup } from "@/lib/store";
import { cleanName } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Joins an existing group with its code. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeJoinCode((await params).code);
    if (!isValidJoinCode(code)) return jsonError("That is not a join code.", 400);

    const name = cleanName((await readJson(request)).name);
    const group = getGroup(code);
    if (!group) return jsonError("No group has that join code.", 404);

    const member = addMember(code, name);
    return NextResponse.json({ group: getGroup(code), member }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
