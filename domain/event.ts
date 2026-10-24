import { CANCELLATION_CUTOFF_MS } from "./types";

export interface SalesRule {
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  occurrenceStartsAt: Date;
}

export type SalesState = "UPCOMING" | "ON_SALE" | "CLOSED";

export function salesState(rule: SalesRule, now: Date): SalesState {
  const start = rule.salesStartAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const closesAt = Math.min(
    rule.salesEndAt?.getTime() ?? Number.POSITIVE_INFINITY,
    rule.occurrenceStartsAt.getTime()
  );
  if (now.getTime() < start) return "UPCOMING";
  if (now.getTime() >= closesAt) return "CLOSED";
  return "ON_SALE";
}

export function canSell(rule: SalesRule, now: Date): boolean {
  return salesState(rule, now) === "ON_SALE";
}

export type PublishCheck = {
  occurrences: { startsAt: Date; status: string }[];
  ticketTypes: { status: string; capacity: number }[];
};

export function publishBlockers(check: PublishCheck, now: Date): string[] {
  const blockers: string[] = [];
  const future = check.occurrences.filter(
    (o) => o.status === "SCHEDULED" && o.startsAt.getTime() > now.getTime()
  );
  if (future.length === 0) blockers.push("Add at least one upcoming occurrence.");
  const sellable = check.ticketTypes.filter((t) => t.status === "ACTIVE" && t.capacity > 0);
  if (sellable.length === 0) blockers.push("Add at least one active ticket type with capacity.");
  return blockers;
}

/** Unpublishing is only safe while nothing has been sold or is being held. */
export function unpublishBlocker(input: {
  confirmedCount: number;
  activeHoldCount: number;
}): string | null {
  if (input.confirmedCount > 0) return "Confirmed reservations exist. Cancel the event instead of unpublishing.";
  if (input.activeHoldCount > 0) return "Active holds exist. Wait for them to expire or be confirmed.";
  return null;
}

export function buyerCancelDeadline(earliestStart: Date): Date {
  return new Date(earliestStart.getTime() - CANCELLATION_CUTOFF_MS);
}
