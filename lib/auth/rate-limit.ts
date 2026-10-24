import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/ids";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window limiter shared through Postgres. The upsert is atomic, so
 * parallel serverless instances cannot each grant a fresh allowance.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit (id, key, "windowStart", count)
    VALUES (${randomToken(12)}, ${key}, ${windowStart}, 1)
    ON CONFLICT (key, "windowStart")
    DO UPDATE SET count = rate_limit.count + 1
    RETURNING count
  `;
  const count = Number(rows[0]?.count ?? limit + 1);
  if (Math.random() < 0.03) {
    void prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(now - 2 * 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(windowStart.getTime() + windowMs),
  };
}

export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
