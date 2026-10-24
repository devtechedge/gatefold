import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD[bytes[i] % 32];
  }
  return out;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function ticketPublicId(): string {
  const raw = randomBase32(20);
  return `GF-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}`;
}

export function normalizeTicketCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, "");
  const withoutPrefix = cleaned.startsWith("GF") ? cleaned.slice(2) : cleaned;
  if (withoutPrefix.length !== 20) return cleaned;
  return `GF-${withoutPrefix.slice(0, 4)}-${withoutPrefix.slice(4, 8)}-${withoutPrefix.slice(8, 12)}-${withoutPrefix.slice(12, 16)}-${withoutPrefix.slice(16, 20)}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
