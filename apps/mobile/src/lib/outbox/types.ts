/**
 * The outbox (02-architecture §Offline sync): photos, expenses and
 * milestone completions made on the phone, kept until the server has them.
 * An item's `id` is its `Idempotency-Key` (D-009); each request it makes
 * uses a key derived from it, so a retry after a lost answer never creates
 * a duplicate (US-MOB-09).
 */
export type OutboxStatus = "waiting" | "sending" | "sent" | "failed";

/** A photo or receipt kept on the phone until it's uploaded (compressed first, D-053). */
export interface LocalPhoto {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  caption?: string | null;
  /** Set once uploaded (`POST /files`), so a retry doesn't upload it again. */
  fileId?: string;
  /** Photos item: set once attached to the job (`POST /jobs/:id/photos`). */
  attached?: boolean;
}

export interface PhotosPayload {
  jobId: string;
  jobName: string;
  milestoneId?: string | null;
  photos: LocalPhoto[];
}

export interface ExpensePayload {
  categoryId: string;
  categoryName: string;
  jobId: string | null;
  jobName: string | null;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Minor units, as the API takes them. */
  amount: string;
  currency: string;
  description: string | null;
  paidBy: "company" | "employee";
  entryMode?: "amount" | "labour";
  labourLines?: { trade: string; headcount: number; dayRateAmount: string }[];
  receipt: LocalPhoto | null;
  /** US-AI-10 — filled in from the receipt by AI, so the expense says so (US-AI-06). Absent on items queued before. */
  aiAssisted?: boolean;
}

export interface CompletionPayload {
  jobId: string;
  jobName: string;
  milestoneId: string;
  milestoneName: string;
  completionNotes: string | null;
  photos: LocalPhoto[];
}

interface Base {
  id: string;
  status: OutboxStatus;
  createdAt: number;
  attempts: number;
  /** Not before this time (ms) after a network failure: back-off (US-MOB-09). */
  nextAttemptAt: number | null;
  /** "Didn't send: …" once the server refused it. */
  error: string | null;
  sentAt: number | null;
}

export type OutboxItem =
  | (Base & { kind: "photos"; payload: PhotosPayload; result: null })
  | (Base & { kind: "expense"; payload: ExpensePayload; result: { expenseId: string } | null })
  | (Base & { kind: "completion"; payload: CompletionPayload; result: { alreadyCompletedBy: string | null; alreadyCompleted: boolean } | null });

/** Biggest upload the server takes (D-053). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
