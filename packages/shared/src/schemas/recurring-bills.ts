import { z } from "zod";
import type { SupplyClass } from "../tax/supply-class.ts";
import { currencyCodeSchema, uuidSchema } from "./common.ts";
import { vendorBillLineInputSchema } from "./purchases.ts";
import { ENDS_BEFORE_START, RECURRING_NAME_REQUIRED, RECURRING_NEEDS_LINE, recurringFrequencySchema, type RecurringFrequency, type RecurringStatus } from "./recurring-invoices.ts";

/**
 * US-PUR-29–31 (D-159) — recurring bills: rent, subscriptions and retainers
 * entered automatically. The same schedule as a recurring invoice (and the
 * same date maths, `occurrenceOnOrAfter`), with vendor bill lines.
 */

export const recurringBillModeSchema = z.enum(["record", "draft"]);
export type RecurringBillMode = z.infer<typeof recurringBillModeSchema>;

export const RECURRING_BILL_MODE_OPTIONS: { value: RecurringBillMode; label: string; short: string }[] = [
  { value: "record", label: "Record the bill", short: "Record" },
  { value: "draft", label: "Save as a draft for me to check", short: "Save as draft" },
];

export const RECURRING_BILL_DUE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "On the bill date" },
  { value: 7, label: "7 days after the bill date" },
  { value: 14, label: "14 days after the bill date" },
  { value: 30, label: "30 days after the bill date" },
  { value: 60, label: "60 days after the bill date" },
];

export const RECURRING_BILL_LINE_ACCOUNT = "Choose an expense account on every line.";
export const DELETE_RECURRING_BILL = "Delete this schedule? Bills it already created are kept.";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

/** `POST /recurring-bills` — "Pick today or a later start date." is checked by the server against organisation time. */
export const createRecurringBillSchema = z
  .object({
    name: z.string().trim().min(1, RECURRING_NAME_REQUIRED).max(120, "Keep the name under 120 characters."),
    contactId: uuidSchema,
    currency: currencyCodeSchema,
    frequency: recurringFrequencySchema,
    dayRule: z.string(),
    startsOn: isoDate,
    endsOn: isoDate.optional().nullable(),
    maxCount: z.coerce.number().int().min(1, "End after at least 1 bill.").max(1000).optional().nullable(),
    dueDays: z.coerce.number().int().min(0).max(365),
    moneyAccountId: uuidSchema.optional().nullable(),
    mode: recurringBillModeSchema,
    lines: z.array(vendorBillLineInputSchema).refine((lines) => lines.some((l) => l.type === "item"), RECURRING_NEEDS_LINE),
  })
  .superRefine((value, ctx) => {
    const valid = value.frequency === "weekly" ? /^[1-7]$/.test(value.dayRule) : value.dayRule === "last" || /^([1-9]|1\d|2[0-8])$/.test(value.dayRule);
    if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dayRule"], message: "Pick which day it runs on." });
    if (value.endsOn && value.endsOn < value.startsOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: ENDS_BEFORE_START });
    if (value.lines.some((l) => l.type === "item" && !l.accountId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: RECURRING_BILL_LINE_ACCOUNT });
  });

/** `PUT /recurring-bills/:id` — the whole schedule again; bills it already created are unchanged. */
export const updateRecurringBillSchema = createRecurringBillSchema;
export type CreateRecurringBillInput = z.infer<typeof createRecurringBillSchema>;

export interface RecurringBillLine {
  id: string;
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  accountId: string | null;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  /** US-TAX-11 — null on heading and text lines. */
  supplyClass: SupplyClass | null;
}

export interface RecurringBill {
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
  moneyAccountId: string | null;
  mode: RecurringBillMode;
  status: RecurringStatus;
  /** Null while paused or finished. */
  nextRunOn: string | null;
  /** Minor units, as a string: the lines' total when last saved. */
  totalAmount: string;
  createdByUserId: string | null;
  createdAt: string;
  lines: RecurringBillLine[];
}
