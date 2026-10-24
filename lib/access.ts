import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/ids";

function reservationSignature(id: string, version: number): string {
  return createHmac("sha256", env.sessionPepper)
    .update(`reservation-access:${id}:${version}`)
    .digest("base64url")
    .slice(0, 22);
}

export function reservationRef(id: string, version: number): string {
  return `${id}.${reservationSignature(id, version)}`;
}

export interface ParsedReservationRef {
  id: string;
  signature: string;
}

export function parseReservationRef(ref: string): ParsedReservationRef | null {
  const dot = ref.indexOf(".");
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { id: ref.slice(0, dot), signature: ref.slice(dot + 1) };
}

export function verifyReservationRef(ref: string, id: string, version: number): boolean {
  const parsed = parseReservationRef(ref);
  if (!parsed || parsed.id !== id) return false;
  return safeEqual(parsed.signature, reservationSignature(id, version));
}
