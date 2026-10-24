import { fromZonedTime } from "date-fns-tz";
import { formatInTimeZone } from "date-fns-tz";

export function parseLocalDateTime(value: string, timeZone: string): Date {
  const date = fromZonedTime(value, timeZone);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date and time");
  return date;
}

export function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "EEE d MMM yyyy");
}

export function formatShortDate(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "d MMM");
}

export function formatTime(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "h:mm a");
}

export function formatDateTime(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "d MMM yyyy, h:mm a");
}

export function formatDateTimeWithZone(date: Date | string, timeZone: string): string {
  return `${formatInTimeZone(date, timeZone, "d MMM yyyy, h:mm a")} (${timeZone.replace("_", " ")})`;
}

export function formatTimeRange(start: Date | string, end: Date | string, timeZone: string): string {
  return `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;
}

export function toDateTimeLocal(date: Date, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function formatMoney(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function formatMonth(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "MMM");
}

export function formatDay(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "d");
}

export function formatWeekday(date: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(date), timeZone, "EEE");
}

/** Defaults for the event form, computed outside a component render. */
export function defaultOccurrenceInputs(daysAhead = 7): { start: string; end: string } {
  const base = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const day = base.toISOString().slice(0, 10);
  return { start: `${day}T19:00`, end: `${day}T22:00` };
}
