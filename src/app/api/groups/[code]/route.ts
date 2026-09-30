import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-response";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/code";
import { getGroup } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeJoinCode((await params).code);
    if (!isValidJoinCode(code)) return jsonError("That is not a join code.", 400);

    const group = getGroup(code);
    if (!group) return jsonError("No group has that join code.", 404);
    return NextResponse.json({ group });
  } catch (error) {
    return handleRouteError(error);
  }
}
