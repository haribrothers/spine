import { formatMoney } from "@spine/shared/money";

/**
 * Formatting for the field app: money and dates the business's way
 * (`member.currency`/`member.locale`, from `GET /org/members/me`), due
 * chips, relative times and the town from a site address.
 */
export interface BusinessFormat {
  currency: string;
  locale: string;
}

export const DEFAULT_FORMAT: BusinessFormat = { currency: "USD", locale: "en-US" };

/** "$64.20", "₹1,250.00" — never a trailing currency code. */
export function money(minor: string | number | bigint, format: BusinessFormat): string {
  return formatMoney(minor, format.currency, format.locale);
}

/** A business date ("2026-10-10" or an ISO timestamp at midnight UTC) as the phone's local calendar day. */
export function calendarDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `now`'s day to `date`'s day (negative in the past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function weekday(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "short" });
}

/** "10 Oct" / "Oct 10". */
export function dayMonth(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** "Sat 10 Oct" / "Sat, Oct 10". */
export function weekdayDayMonth(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** "Thursday 8 October" for the welcome card. */
export function longDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

export type ChipStatus = "paid" | "due-soon" | "overdue" | "draft";

/**
 * A milestone's due chip (US-MOB-03): "2 days late" in the overdue colour,
 * "Due today", "Due tomorrow", "Due Sat" within the week, else "Due 3 Nov".
 */
export function dueChip(dueDate: string, locale: string, now: Date = new Date()): { label: string; status: ChipStatus } {
  const due = calendarDay(dueDate);
  const days = daysUntil(due, now);
  if (days < 0) return { label: `${plural(-days, "day", "days")} late`, status: "overdue" };
  if (days === 0) return { label: "Due today", status: "due-soon" };
  if (days === 1) return { label: "Due tomorrow", status: "due-soon" };
  if (days < 7) return { label: `Due ${weekday(due, locale)}`, status: "due-soon" };
  return { label: `Due ${dayMonth(due, locale)}`, status: "draft" };
}

/** "Sat" within the week, else "10 Oct" — for "next Sat" on the KPI card. */
export function shortWhen(dueDate: string, locale: string, now: Date = new Date()): string {
  const due = calendarDay(dueDate);
  const days = daysUntil(due, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 1 && days < 7 ? weekday(due, locale) : dayMonth(due, locale);
}

/** "10 min ago", "1 h ago", "Yesterday", "Tue", "5 Oct" (iOS); "10m", "1h", … on Android. */
export function relativeTime(iso: string, locale: string, now: Date = new Date(), compact = false): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return compact ? "now" : "Just now";
  if (minutes < 60) return compact ? `${minutes}m` : `${minutes} min ago`;
  const days = -daysUntil(at, now);
  if (days === 0) return compact ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return weekday(at, locale);
  return dayMonth(at, locale);
}

/**
 * The town in a site address, for "Customer · Portland": the last part,
 * without its postcode — or the part before it when that's only a state
 * code ("Portland, ME 04101" → "Portland"; "Pune 411045" → "Pune").
 */
export function townFrom(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const strip = (part: string) => part.replace(/\b[A-Z]?\d[\dA-Z -]*$/, "").trim();
  const last = strip(parts[parts.length - 1]!);
  if (last && !/^[A-Z]{2,3}$/.test(last) && !/\d/.test(last)) return last;
  return strip(parts[parts.length - 2]!) || null;
}

/** The address on one line ("48 Harbor Way, Portland, ME 04101"). */
export function oneLine(address: string): string {
  return address.replace(/\s*\n\s*/g, ", ");
}
