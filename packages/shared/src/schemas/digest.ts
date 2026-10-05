import { z } from "zod";
import type { AttentionKind } from "./attention.ts";

/**
 * US-NTF-13/14 (D-093) — the daily digest email: on by default for Owners
 * at 7:00 AM Monday to Friday, off for others; skipped on days with
 * nothing to report; never money for Field users.
 */

export const DIGEST_DAYS = ["weekdays", "daily"] as const;
export type DigestDays = (typeof DIGEST_DAYS)[number];

export const DIGEST_DAYS_LABELS: Record<DigestDays, string> = {
  weekdays: "Monday to Friday",
  daily: "Every day",
};

/** `PUT /users/me/notification-preferences` — self only. "Send at" is organisation time, on a quarter hour. */
export const notificationPreferencesSchema = z.object({
  digestEnabled: z.boolean(),
  digestTime: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, { error: "Choose a time on the quarter hour, like 07:00 or 06:30." }),
  digestDays: z.enum(DIGEST_DAYS),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

/** What `GET /users/me` reports: the stored choice resolved against the role default. */
export interface DigestPreferences {
  digestEnabled: boolean;
  digestTime: string;
  digestDays: DigestDays;
}

/** The role default when the member never chose (D-093). */
export function digestEnabledFor(role: string | null | undefined, stored: boolean | null | undefined): boolean {
  return stored ?? role === "owner";
}

/** "Send at" choices for the Profile form: every half hour from 5:00 AM to 11:00 AM. */
export const DIGEST_TIMES: { value: string; label: string }[] = Array.from({ length: 13 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: `${h}:${String(m).padStart(2, "0")} AM` };
});

/** "6:30 AM" for "06:30", "1:15 PM" for "13:15". */
export function digestTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
}

/** A late run (after a restart) still sends within this many hours of "Send at"; later than that, the day is skipped. */
export const DIGEST_WINDOW_HOURS = 3;

/**
 * Whether a member's digest is due now. `today` is the organisation date
 * (`YYYY-MM-DD`), `nowTime` its time (`HH:MM`).
 */
export function digestDue(pref: { enabled: boolean; time: string; days: string; lastSentOn: string | null }, today: string, nowTime: string): boolean {
  if (!pref.enabled || pref.lastSentOn === today) return false;
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (pref.days !== "daily" && (weekday === 0 || weekday === 6)) return false;
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const since = toMinutes(nowTime) - toMinutes(pref.time);
  return since >= 0 && since < DIGEST_WINDOW_HOURS * 60;
}

/** The attention rows' names in the digest's table. */
export const DIGEST_LABELS: Record<AttentionKind, string> = {
  invoices_overdue: "Overdue invoices",
  expenses_awaiting_approval: "Expenses waiting for approval",
  quotes_discount_approval: "Discounts to approve",
  milestones_to_invoice: "Milestones ready to invoice",
  quotes_expiring: "Quotes expiring this week",
  vendor_bills_due: "Bills due in the next 3 days",
  jobs_over_budget: "Jobs over budget",
  followups_overdue: "Overdue follow-ups",
  milestones_due: "Milestones due this week",
  expenses_rejected: "Expenses sent back to you",
};

/** "Your Spine day: 6 things need you · Sun 4 Oct" */
export function digestSubject(rows: number, today: string): string {
  const day = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const need = rows === 0 ? "nothing needs you" : `${rows} ${rows === 1 ? "thing needs" : "things need"} you`;
  return `Your Spine day: ${need} · ${day}`;
}

/** The footer line that says why the email came and how to stop it. */
export function digestFooter(role: string | null | undefined, business: string): string {
  return `You get this daily digest because you're ${role === "owner" ? "an owner" : "a member"} of ${business}. Turn it off or change the time in Profile › Notifications.`;
}
