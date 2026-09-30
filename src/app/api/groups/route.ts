import { NextResponse } from "next/server";
import { handleRouteError, readJson } from "@/lib/api-response";
import { addMember, createGroup, getGroup } from "@/lib/store";
import { MAX_GROUP_NAME_LENGTH, cleanName } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a group and puts the person who made it in it. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const groupName = cleanName(body.groupName ?? "Study group", MAX_GROUP_NAME_LENGTH);
    const memberName = cleanName(body.memberName);

    const created = createGroup(groupName);
    const member = addMember(created.code, memberName);

    return NextResponse.json({ group: getGroup(created.code), member }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
