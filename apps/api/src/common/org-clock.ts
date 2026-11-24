/**
 * The organisation's local date and time — "organisation time" in the spec
 * (reminder "Send at", recurring invoices at 6:00 AM, the daily digest).
 * Spine serves one organisation per instance, so its time zone is the
 * server's `TZ` setting (UTC when unset).
 */
export function orgTimeZone(): string {
  return process.env.TZ || "UTC";
}

/** `{ date: "2026-10-05", time: "09:15" }` for `now` in the organisation's time zone. */
export function orgClock(now: Date = new Date(), timeZone: string = orgTimeZone()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD` calendar dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);
}
