/** Mirrors apps/api/src/db/schema/jobs.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following invoices/quotes' own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `toDecimalString`. */
export type JobStatus = "active" | "on_hold" | "completed" | "cancelled";
export type MilestoneAmountType = "fixed" | "percent";
export type MilestoneStatus = "pending" | "completed" | "invoiced";

export interface Job {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string | null;
  sourceQuoteId: string | null;
  name: string;
  siteAddress: string | null;
  status: JobStatus;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  contractValueAmount: string;
  retentionPct: number;
  notes: string | null;
  createdByUserId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  jobId: string;
  orgId: string;
  name: string;
  sequence: number;
  amountType: MilestoneAmountType;
  amount: number;
  resolvedAmount: string;
  status: MilestoneStatus;
  dueDate: string | null;
  createdByUserId: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  invoicedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  orgId: string;
  milestoneId: string | null;
  fileId: string;
  caption: string | null;
  uploadedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface JobNote {
  id: string;
  jobId: string;
  orgId: string;
  body: string;
  createdByUserId: string | null;
  createdAt: string;
}

/** GET /jobs/:id/variation-orders row shape — VariationOrdersService.list joins in the wrapped quote. */
export interface JobVariationOrder {
  id: string;
  jobId: string;
  quoteId: string;
  orgId: string;
  appliedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  quote: {
    id: string;
    number: string | null;
    status: "draft" | "sent" | "accepted" | "rejected";
    currency: string;
    totalAmount: string;
  };
}

/** Minimal shape used by the variation-order line editor's catalog-item picker. Mirrors quotes/types.ts's CatalogItemOption (kept as its own copy per this module's existing duplication precedent — see variation-order-line-editor.tsx's own doc comment). */
export interface VariationOrderCatalogItemOption {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRatePercentage: number;
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  archivedAt: string | null;
}

/** FEAT-08 — used by the variation-order line editor's tax picker. Mirrors apps/api's TaxRatesService/TaxGroupsService row shapes (and quotes/types.ts's own copy). */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  archivedAt: string | null;
}

export interface TaxGroupOption {
  id: string;
  name: string;
  archivedAt: string | null;
  taxRates: TaxRateOption[];
}

/** JobCostingService.report's response shape — revenue side only until Phase 4 supplies costs (see that service's own doc comment). `cost`/`margin` are correctly 0 today, not a bug. */
export interface JobCostingReport {
  jobId: string;
  currency: string;
  contractValueAmount: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  invoiced: "Invoiced",
};

/** Minimal shape used by the contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}

/** Editable row for the milestone-set editor — mirrors packages/shared/src/schemas/jobs.ts's `milestoneInputSchema`, plus a client-only `key` for React list identity before a milestone has a real `id`. */
export interface EditableMilestone {
  key: string;
  id?: string;
  name: string;
  sequence: number;
  amountType: MilestoneAmountType;
  amount: number;
  dueDate: string | null;
  /** Present only for an existing milestone loaded from the server — used to block edits to an already-invoiced row in the UI, mirroring MilestonesService.setAll's own server-side guard. */
  status?: MilestoneStatus;
}

/** Minimal shape used by the "already uploaded" file reference this two-step upload flow produces (POST /files response). */
export interface UploadedFile {
  id: string;
}

/** GET /jobs/:id/assignees row shape — JobsService.listAssignees joins in the assigned user's name/email (Phase 5, S-11.2 — who sees this job on their mobile home screen). */
export interface JobAssignee {
  id: string;
  userId: string;
  assignedAt: string;
  name: string;
  email: string;
}
