import { timingSafeEqual } from "node:crypto";
import { withApi, jsonOk } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { env } from "@/lib/env";
import { expireDueHolds } from "@/services/reservations";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const POST = withApi(async (request) => {
  if (!env.cronSecret) {
    throw new HttpError("INVALID_STATE", "Scheduled maintenance is not configured.", 503);
  }
  if (!authorized(request)) {
    throw new HttpError("UNAUTHORIZED", "A maintenance bearer token is required.", 401);
  }
  const expired = await expireDueHolds({ limit: 100 });
  return jsonOk({ expired, at: new Date().toISOString() });
});
