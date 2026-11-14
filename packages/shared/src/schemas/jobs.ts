import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";
import { quoteLineInputSchema } from "./quotes.ts";

export const jobStatusSchema = z.enum(["active", "on_hold", "completed", "cancelled"]);
export const milestoneAmountTypeSchema = z.enum(["fixed", "percent"]);
export const milestoneStatusSchema = z.enum(["pending", "completed", "invoiced"]);

/** US-JOB-30 */
export const JOB_END_BEFORE_START = "End the job on or after its start date.";

/**
 * PRD F4 (S-04.1) — a job created directly (not from a quote). The
 * from-quote path (`POST /jobs/from-quote/:quoteId`) doesn't use this
 * schema at all — JobsService.createFromQuote derives every field itself
 * from the accepted quote's own snapshot, mirroring how
 * InvoicesService.convertFromQuote never accepts a client body either.
 */
export const createJobSchema = z.object({
  contactId: uuidSchema,
  name: z.string().min(1),
  siteAddress: z.string().optional().nullable(),
  currency: currencyCodeSchema,
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  contractValueAmount: z.coerce.bigint().default(0n),
  retentionPct: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
}).refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: JOB_END_BEFORE_START, path: ["endDate"] });

export const BUDGET_NOT_NEGATIVE = "Enter a budget of zero or more.";
export const PERCENT_COMPLETE_RANGE = "Enter a percentage from 0 to 100.";

export const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  siteAddress: z.string().optional().nullable(),
  status: jobStatusSchema.optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  retentionPct: z.coerce.number().min(0).max(100).optional(),
  /** US-JOB-24 — minor units; null clears the budget. */
  costBudgetAmount: z.union([z.null(), z.coerce.bigint().refine((v) => v >= 0n, BUDGET_NOT_NEGATIVE)]).optional(),
  /** US-JOB-28 — 0–100; null clears it. */
  percentComplete: z.union([z.null(), z.coerce.number({ error: PERCENT_COMPLETE_RANGE }).min(0, PERCENT_COMPLETE_RANGE).max(100, PERCENT_COMPLETE_RANGE)]).optional(),
  notes: z.string().optional().nullable(),
});

/**
 * S-04.2/S-04.3 — one milestone's input. `amount` means different things
 * depending on `amountType` (a 0-100 percentage of the job's contract
 * value, or a literal minor-units amount) — see jobs.ts's own schema
 * comment on the identically-shaped DB column.
 */
export const milestoneInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1),
  sequence: z.coerce.number().int().default(0),
  amountType: milestoneAmountTypeSchema.default("percent"),
  amount: z.coerce.number().min(0),
  dueDate: z.coerce.date().optional().nullable(),
});

/** S-04.3 — the whole milestone set is replaced/validated together (like invoice/quote lines), since "do the percentages total 100%" is a whole-job check, not a per-milestone one. */
export const setMilestonesSchema = z.object({
  milestones: z.array(milestoneInputSchema).min(1),
});

export const completeMilestoneSchema = z.object({
  completionNotes: z.string().optional().nullable(),
  /** File ids already uploaded via `POST /files` — same pattern as any other file-attaching endpoint in this codebase (files are uploaded first, then referenced by id). */
  photoFileIds: z.array(uuidSchema).default([]),
});

export const addJobNoteSchema = z.object({
  body: z.string().min(1),
});

export const addJobPhotoSchema = z.object({
  fileId: uuidSchema,
  caption: z.string().optional().nullable(),
  /** US-MOB-11 — the milestone the photo shows (optional; must be one of the job's). */
  milestoneId: uuidSchema.optional().nullable(),
});

/** Phase 5 (Mobile) — assigns one field/staff/owner user to a job's crew. See jobs.ts's `jobAssignments` schema comment for why this is a join table, not a single column. */
export const assignJobSchema = z.object({
  userId: z.string().min(1),
});

/**
 * S-04.9 — builds the supplementary quote a variation order wraps.
 * `contactId`/`currency` are optional here (unlike `createQuoteSchema`,
 * where both are required) because VariationOrdersService.create defaults
 * either to the job's own contact/currency when omitted — a variation is
 * almost always for the same customer/currency as the job itself, so
 * requiring the caller to repeat them on every variation would be pure
 * friction.
 */
export const createVariationOrderSchema = z.object({
  contactId: uuidSchema.optional(),
  currency: currencyCodeSchema.optional(),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  lines: z.array(quoteLineInputSchema).default([]),
});

/**
 * US-JOB-31, US-JOB-33 (D-215) — what `GET /jobs?include=billing` and
 * `GET /jobs/:id?include=billing` add for Owners and Staff: billed to date
 * (US-JOB-27's figure), the completed milestones not yet invoiced, and the
 * retention held (the balance of the job's 1150 Retention Receivable
 * journal lines). Money is minor units as strings.
 */
export interface JobBilling {
  billedAmount: string;
  /** Whole percent of the contract; null for a zero contract. */
  billedPct: number | null;
  readyToBillCount: number;
  readyToBillAmount: string;
  retentionHeld: string;
}

/** US-JOB-37 — what `GET /jobs/:id/activity` returns, newest first. */
export const JOB_ACTIVITY_TYPES = [
  "created",
  "created_from_quote",
  "status_changed",
  "updated",
  "milestones_set",
  "milestone_completed",
  "milestone_invoiced",
  "variation_order_created",
  "variation_order_applied",
  "photo_added",
  "photo_removed",
  "note_added",
  "crew_assigned",
  "crew_unassigned",
  "retention_released",
] as const;
export type JobActivityType = (typeof JOB_ACTIVITY_TYPES)[number];
export interface JobActivityEntry {
  at: string;
  type: JobActivityType;
  actorName: string | null;
  /**
   * The quote number it came from, the new status, the milestone's name
   * (with its invoice number), the variation's quote number, the milestone
   * a photo came with, the crew member's name, or the release invoice.
   */
  detail: string | null;
  /** What it points at: the source quote, the invoice, or the variation quote. */
  linkId?: string | null;
}

/**
 * US-JOB-39 (D-277) — deleting a job photo. A photo is locked once its job
 * is Completed or Cancelled, or its milestone is invoiced; then only an
 * Owner can delete it, with a reason.
 */
export const JOB_PHOTO_LOCK_REASONS = ["job_completed", "job_cancelled", "milestone_invoiced"] as const;
export type JobPhotoLockReason = (typeof JOB_PHOTO_LOCK_REASONS)[number];
export const PHOTO_NOT_YOURS = "PHOTO_NOT_YOURS";
export const PHOTO_NOT_YOURS_MESSAGE = "You can delete only photos you added.";
export const PHOTO_LOCKED = "PHOTO_LOCKED";
export const REASON_REQUIRED = "REASON_REQUIRED";
export const PHOTO_REASON_REQUIRED_MESSAGE = "Give a reason for deleting this photo. The job's activity keeps it.";
export const PHOTO_ALREADY_DELETED_MESSAGE = "This photo has already been deleted.";
const LOCKED_BECAUSE: Record<JobPhotoLockReason, string> = {
  job_completed: "the job is completed",
  job_cancelled: "the job is cancelled",
  milestone_invoiced: "the milestone is invoiced",
};
export const photoLockedMessage = (reason: JobPhotoLockReason) => `This photo can't be deleted any more: ${LOCKED_BECAUSE[reason]}. Ask an Owner.`;

export const removeJobPhotoSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});
export type RemoveJobPhotoInput = z.infer<typeof removeJobPhotoSchema>;

/** Which lock, if any, applies to a photo: the job's status first, then its milestone's. */
export function jobPhotoLock(jobStatus: string, milestoneStatus: string | null): JobPhotoLockReason | null {
  if (jobStatus === "completed") return "job_completed";
  if (jobStatus === "cancelled") return "job_cancelled";
  if (milestoneStatus === "invoiced") return "milestone_invoiced";
  return null;
}
