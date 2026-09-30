import { NextResponse } from "next/server";
import { NotFoundError } from "./store";
import { ValidationError } from "./validate";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Turns the store's and validator's own errors into the message the person
 *  reads, and keeps anything unexpected off the wire. */
export function handleRouteError(error: unknown) {
  if (error instanceof ValidationError) return jsonError(error.message, 400);
  if (error instanceof NotFoundError) return jsonError(error.message, 404);
  console.error("[sumai] request failed", error);
  return jsonError("Something went wrong on our end. Try again.", 500);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}
