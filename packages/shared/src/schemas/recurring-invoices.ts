import { z } from "zod";
import type { SupplyClass } from "../tax/supply-class.ts";
import { currencyCodeSchema, uuidSchema } from "./common.ts";
import { invoiceLineInputSchema } from "./invoices.ts";

/**
 * US-INV-20–22 (D-092) — recurring invoices: a schedule plus template lines
 * that Spine turns into an invoice on each due date (6:00 AM organisation
 * time, US-INV-21).
 */

export const recurringFrequencySchema = z.enum(["weekly", "monthly", "quarterly", "yearly"]);
export type RecurringFrequency = z.infer<typeof recurringFrequencySchema>;
export const recurringModeSchema = z.enum(["issue_and_email", "draft"]);
export type RecurringMode = z.infer<typeof recurringModeSchema>;
export type RecurringStatus = "active" | "paused" | "finished";

export const RECURRING_FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Yearly" },
];

export const RECURRING_MODE_OPTIONS: { value: RecurringMode; label: string; short: string }[] = [
  { value: "issue_and_email", label: "Issue the invoice and email it to the customer", short: "Issue and email" },
  { value: "draft", label: "Create a draft for me to review", short: "Create draft" },
];

export const RECURRING_DUE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "On receipt" },
  { value: 7, label: "7 days after issue" },
  { value: 14, label: "14 days after issue" },
  { value: 30, label: "30 days after issue" },
  { value: 60, label: "60 days after issue" },
];

export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = { active: "Active", paused: "Paused", finished: "Finished" };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/**
 * The "On" choices for a frequency. Weekly: ISO weekday "1" (Monday)–"7".
 * Otherwise a day of the month "1"–"28" or "last" — never 29–31, so every
 * month has the day.
 */
export function recurringDayOptions(frequency: RecurringFrequency): { value: string; label: string }[] {
  if (frequency === "weekly") return WEEKDAYS.map((label, i) => ({ value: String(i + 1), label }));
  return [...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${ordinal(i + 1)} of the month` })), { value: "last", label: "Last day of the month" }];
}

/** "Monthly · 1st", "Every 3 months · 15th", "Monthly · last day", "Weekly · Monday". */
export function describeRepeats(frequency: RecurringFrequency, dayRule: string): string {
  const label = RECURRING_FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency;
  const on = frequency === "weekly" ? (WEEKDAYS[Number(dayRule) - 1] ?? dayRule) : dayRule === "last" ? "last day" : ordinal(Number(dayRule));
  return `${label} · ${on}`;
}

export const START_IN_PAST = "Pick today or a later start date.";
export const ENDS_BEFORE_START = "Pick an end date after the start date.";
export const RECURRING_NAME_REQUIRED = "Give the schedule a name.";
export const RECURRING_NEEDS_LINE = "Add at least one line.";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

/** `POST /recurring-invoices` — "Pick today or a later start date." is checked by the server against organisation time. */
export const createRecurringInvoiceSchema = z
  .object({
    name: z.string().trim().min(1, RECURRING_NAME_REQUIRED).max(120, "Keep the name under 120 characters."),
    contactId: uuidSchema,
    currency: currencyCodeSchema,
    frequency: recurringFrequencySchema,
    dayRule: z.string(),
    startsOn: isoDate,
    endsOn: isoDate.optional().nullable(),
    maxCount: z.coerce.number().int().min(1, "End after at least 1 invoice.").max(1000).optional().nullable(),
    dueDays: z.coerce.number().int().min(0).max(365),
    mode: recurringModeSchema,
    lines: z.array(invoiceLineInputSchema).refine((lines) => lines.some((l) => l.type === "item"), RECURRING_NEEDS_LINE),
  })
  .superRefine((value, ctx) => {
    const valid = value.frequency === "weekly" ? /^[1-7]$/.test(value.dayRule) : value.dayRule === "last" || /^([1-9]|1\d|2[0-8])$/.test(value.dayRule);
    if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dayRule"], message: "Pick which day it runs on." });
    if (value.endsOn && value.endsOn < value.startsOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: ENDS_BEFORE_START });
  });

/** `PUT /recurring-invoices/:id` — the whole schedule again; changes reach only invoices it creates from now on. */
export const updateRecurringInvoiceSchema = createRecurringInvoiceSchema;

export type CreateRecurringInvoiceInput = z.infer<typeof createRecurringInvoiceSchema>;

export interface RecurringSchedule {
  frequency: RecurringFrequency;
  dayRule: string;
  startsOn: string;
}

function parts(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The schedule's first run date on or after `from`. Monthly, every-3-months
 * and yearly schedules count their months from the start date's month.
 */
export function occurrenceOnOrAfter(schedule: RecurringSchedule, from: string): string {
  const start = from < schedule.startsOn ? schedule.startsOn : from;
  if (schedule.frequency === "weekly") {
    const weekday = ((new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // ISO: Monday 1 … Sunday 7
    return addDays(start, (Number(schedule.dayRule) - weekday + 7) % 7);
  }
  const step = schedule.frequency === "monthly" ? 1 : schedule.frequency === "quarterly" ? 3 : 12;
  const anchor = parts(schedule.startsOn);
  const anchorIndex = anchor.y * 12 + (anchor.m - 1);
  const s = parts(start);
  let index = s.y * 12 + (s.m - 1);
  index += (((anchorIndex - index) % step) + step) % step; // the first month in step with the anchor
  for (;;) {
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const day = schedule.dayRule === "last" ? daysInMonth(y, m) : Number(schedule.dayRule);
    const candidate = iso(y, m, day);
    if (candidate >= start) return candidate;
    index += step;
  }
}

/** The run date after `date` (exclusive). */
export function occurrenceAfter(schedule: RecurringSchedule, date: string): string {
  return occurrenceOnOrAfter(schedule, addDays(date, 1));
}

/** Where a schedule stands after `createdCount` invoices with the next date `next`: finished once an end condition is reached. */
export function scheduleFinished(next: string, ends: { endsOn?: string | null; maxCount?: number | null }, createdCount: number): boolean {
  if (ends.maxCount && createdCount >= ends.maxCount) return true;
  return !!ends.endsOn && next > ends.endsOn;
}

export interface RecurringInvoiceLine {
  id: string;
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  discountPercentage: number;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  /** US-TAX-11 — null on heading and text lines. */
  supplyClass: SupplyClass | null;
}

export interface RecurringInvoice {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  currency: string;
  frequency: RecurringFrequency;
  dayRule: string;
  startsOn: string;
  endsOn: string | null;
  maxCount: number | null;
  createdCount: number;
  dueDays: number;
  mode: RecurringMode;
  status: RecurringStatus;
  /** Null while paused or finished. */
  nextRunOn: string | null;
  /** Minor units, as a string: the lines' total at today's prices. */
  totalAmount: string;
  createdByUserId: string | null;
  createdAt: string;
  lines: RecurringInvoiceLine[];
}
