import { CANCELLATION_CUTOFF_MS, type ReservationState } from "./types";

const TRANSITIONS: Record<ReservationState, ReservationState[]> = {
  PENDING_HOLD: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: ReservationState, to: ReservationState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReservationState, to: ReservationState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid reservation transition: ${from} -> ${to}`);
  }
}

/** Confirmation is allowed only while the hold is still within its deadline. */
export function confirmationAllowed(holdExpiresAt: Date, now: Date): boolean {
  return holdExpiresAt.getTime() > now.getTime();
}

/** Buyer cancellation of a confirmed booking closes 24 hours before the first occurrence. */
export function buyerCancellationAllowed(earliestStart: Date, now: Date): boolean {
  return now.getTime() <= earliestStart.getTime() - CANCELLATION_CUTOFF_MS;
}

export function isHoldExpired(holdExpiresAt: Date, now: Date): boolean {
  return holdExpiresAt.getTime() <= now.getTime();
}
