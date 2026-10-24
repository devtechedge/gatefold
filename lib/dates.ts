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

export function formatDate(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEE d MMM yyyy");
}

export function formatShortDate(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "d MMM");
}

export function formatTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

export function formatDateTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "d MMM yyyy, h:mm a");
}

export function formatDateTimeWithZone(date: Date, timeZone: string): string {
  return `${formatInTimeZone(date, timeZone, "d MMM yyyy, h:mm a")} (${timeZone.replace("_", " ")})`;
}

export function formatTimeRange(start: Date, end: Date, timeZone: string): string {
  return `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;
}

export function toDateTimeLocal(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function formatMoney(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function formatMonth(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "MMM");
}

export function formatDay(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "d");
}

export function formatWeekday(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEE");
}
