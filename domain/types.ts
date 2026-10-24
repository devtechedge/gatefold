export const RESERVATION_STATES = [
  "PENDING_HOLD",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];

export const EVENT_STATES = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;
export type EventState = (typeof EVENT_STATES)[number];

export const TICKET_STATES = ["VALID", "VOID"] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const HOLD_DURATION_MS = 10 * 60 * 1000;
export const CANCELLATION_CUTOFF_MS = 24 * 60 * 60 * 1000;

export const CATEGORIES = [
  "Music",
  "Markets",
  "Talks",
  "Workshops",
  "Performance",
  "Community",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ARTWORKS = ["vermilion", "lime", "cobalt", "ink", "rose"] as const;
export type Artwork = (typeof ARTWORKS)[number];

export function isReservationState(value: string): value is ReservationState {
  return (RESERVATION_STATES as readonly string[]).includes(value);
}

export function isEventState(value: string): value is EventState {
  return (EVENT_STATES as readonly string[]).includes(value);
}
