import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";

export function requestId(): string {
  return randomUUID();
}

export function jsonOk(data: unknown, status = 200, id = requestId()): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "x-request-id": id, "cache-control": "no-store" },
  });
}

export function jsonError(error: unknown, id = requestId()): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requestId: id } },
      { status: error.status, headers: { "x-request-id": id, "cache-control": "no-store" } }
    );
  }
  console.error(`[${id}]`, error instanceof Error ? error.message : "unknown error");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Try again.",
        requestId: id,
      },
    },
    { status: 500, headers: { "x-request-id": id, "cache-control": "no-store" } }
  );
}

type Handler<C> = (request: Request, context: C, id: string) => Promise<Response>;

export function withApi<C>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const id = requestId();
    try {
      return await handler(request, context, id);
    } catch (error) {
      return jsonError(error, id);
    }
  };
}

/**
 * Browser CSRF guard. Requests without an Origin header are not browser
 * cross-site requests, so they are allowed; a present Origin must match Host.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new HttpError("FORBIDDEN", "Invalid request origin.", 403);
  }
  const host = request.headers.get("host");
  if (!host || parsed.host !== host) {
    throw new HttpError("FORBIDDEN", "Cross-origin request refused.", 403);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError("VALIDATION_ERROR", "Send JSON with a content-type of application/json.", 400);
  }
  const text = await request.text();
  if (text.length > 64_000) {
    throw new HttpError("VALIDATION_ERROR", "Request body is too large.", 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError("VALIDATION_ERROR", "Request body is not valid JSON.", 400);
  }
}

export function parseValidation<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } }
): T {
  if (result.success) return result.data;
  const first = result.error.issues[0];
  throw new HttpError(
    "VALIDATION_ERROR",
    first?.message ?? "The request did not pass validation.",
    400
  );
}
