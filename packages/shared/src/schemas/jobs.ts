import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

export const jobStatusSchema = z.enum(["active", "on_hold", "completed", "cancelled"]);
export const milestoneAmountTypeSchema = z.enum(["fixed", "percent"]);
export const milestoneStatusSchema = z.enum(["pending", "completed", "invoiced"]);

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
});

export const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  siteAddress: z.string().optional().nullable(),
  status: jobStatusSchema.optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  retentionPct: z.coerce.number().min(0).max(100).optional(),
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
});
