import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/ids";

const PREFIX = "GF1";

function signatureFor(publicId: string): string {
  return createHmac("sha256", env.ticketSigningSecret)
    .update(`ticket:${publicId}`)
    .digest("base64url")
    .slice(0, 22);
}

export function ticketQrPayload(publicId: string): string {
  return `${PREFIX}.${publicId}.${signatureFor(publicId)}`;
}

export type QrVerification =
  | { kind: "signed"; publicId: string }
  | { kind: "unsigned"; publicId: string }
  | { kind: "invalid" };

/**
 * A valid signature proves the reference was minted by Gatefold. A manual code
 * has no signature but is still checked against authoritative ticket state, so
 * the caller must treat both outcomes as untrusted references.
 */
export function verifyQrPayload(payload: string): QrVerification {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(`${PREFIX}.`)) {
    return trimmed.length > 0 ? { kind: "unsigned", publicId: trimmed } : { kind: "invalid" };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) return { kind: "invalid" };
  const [, publicId, signature] = parts;
  if (!publicId || !signature) return { kind: "invalid" };
  if (!safeEqual(signature, signatureFor(publicId))) {
    return { kind: "invalid" };
  }
  return { kind: "signed", publicId };
}
