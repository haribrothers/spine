import { AccessRemovedError, ApiError, OfflineError, ServerUnreachableError, SessionExpiredError, UpdateRequiredError } from "../api/errors";
import { fileFormData, type RequestOptions, type Method } from "../api/request";
import { MAX_UPLOAD_BYTES, type LocalPhoto, type OutboxItem } from "./types";
import { outbox } from "./outbox";

/** How the outbox reaches the API: the signed-in session's `request`. */
export type Transport = <T>(method: Method, path: string, options?: Omit<RequestOptions, "token">) => Promise<T>;

/** The server refused the item: it won't succeed by retrying. Shown in red with "Fix" (US-MOB-09). */
export class RejectedError extends Error {}

/** Sending can't go on for now (an update is needed, or the session ended); items stay queued. */
export class PausedError extends Error {
  constructor(readonly reason: "updateRequired" | "signedOut") {
    super(reason);
  }
}

export type FailureKind = "transient" | "rejected" | "paused";

/** Network trouble retries with back-off and stays "Waiting" (US-MOB-09); a refusal needs fixing. */
export function classify(error: unknown): FailureKind {
  if (error instanceof RejectedError) return "rejected";
  if (error instanceof PausedError || error instanceof UpdateRequiredError || error instanceof SessionExpiredError || error instanceof AccessRemovedError) return "paused";
  if (error instanceof OfflineError || error instanceof ServerUnreachableError) return "transient";
  if (error instanceof ApiError) return error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500 ? "transient" : "rejected";
  return "transient";
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** "Didn't send: the receipt photo is over 10 MB." */
export function rejectionMessage(item: OutboxItem, error: unknown): string {
  const tooBig = item.kind === "expense" ? "the receipt photo is over 10 MB" : "a photo is over 10 MB";
  if (error instanceof ApiError && error.status === 413) return `Didn't send: ${tooBig}.`;
  if (error instanceof ApiError && error.status === 404 && item.kind !== "expense") return "Didn't send: this job isn't on your list any more.";
  const message = error instanceof Error && error.message ? error.message : "the server refused it";
  return `Didn't send: ${sentence(lowerFirst(message))}`;
}

/** Long uploads on a weak signal need longer than an ordinary request. */
const UPLOAD_TIMEOUT_MS = 120_000;

async function upload(transport: Transport, item: OutboxItem, photo: LocalPhoto, key: string): Promise<string> {
  if (photo.size > MAX_UPLOAD_BYTES) throw new RejectedError(rejectionMessage(item, new ApiError("too large", 413)));
  // A copy the phone lost would otherwise look like a network error and retry for ever.
  if (!outbox.hasFile(photo)) throw new RejectedError(`Didn't send: ${item.kind === "expense" ? "the receipt photo" : "a photo"} is no longer on this phone. Take it again or remove it.`);
  const file = await transport<{ id: string }>("POST", "/files", { formData: fileFormData(photo), idempotencyKey: key, timeoutMs: UPLOAD_TIMEOUT_MS });
  return file.id;
}

/**
 * Sends one item, step by step. After every step the item is saved with
 * what's done (uploaded file ids, attached photos), so a retry carries on
 * where it stopped; each step's `Idempotency-Key` is derived from the
 * item's id, so a step whose answer was lost returns its first result
 * instead of a duplicate (D-009, US-MOB-09).
 */
export async function sendItem(item: OutboxItem, transport: Transport, save: (item: OutboxItem) => Promise<void>): Promise<OutboxItem> {
  try {
    if (item.kind === "photos") {
      const photos = [...item.payload.photos];
      for (let i = 0; i < photos.length; i++) {
        if (!photos[i]!.fileId) {
          photos[i] = { ...photos[i]!, fileId: await upload(transport, item, photos[i]!, `${item.id}:file:${i}`) };
          await save({ ...item, payload: { ...item.payload, photos } });
        }
        if (!photos[i]!.attached) {
          await transport("POST", `/jobs/${item.payload.jobId}/photos`, { body: { fileId: photos[i]!.fileId, caption: photos[i]!.caption ?? null }, idempotencyKey: `${item.id}:photo:${i}` });
          photos[i] = { ...photos[i]!, attached: true };
          await save({ ...item, payload: { ...item.payload, photos } });
        }
      }
      return { ...item, payload: { ...item.payload, photos }, result: null };
    }

    if (item.kind === "expense") {
      let receipt = item.payload.receipt;
      if (receipt && !receipt.fileId) {
        receipt = { ...receipt, fileId: await upload(transport, item, receipt, `${item.id}:file`) };
        await save({ ...item, payload: { ...item.payload, receipt } });
      }
      const p = item.payload;
      const created = await transport<{ id: string }>("POST", "/expenses", {
        body: {
          categoryId: p.categoryId,
          jobId: p.jobId,
          date: p.date,
          currency: p.currency,
          amount: p.amount,
          description: p.description,
          paidBy: p.paidBy,
          receiptFileId: receipt?.fileId ?? null,
          ...(p.entryMode ? { entryMode: p.entryMode } : {}),
          ...(p.labourLines ? { labourLines: p.labourLines } : {}),
        },
        idempotencyKey: item.id,
      });
      return { ...item, payload: { ...item.payload, receipt }, result: { expenseId: created.id } };
    }

    const photos = [...item.payload.photos];
    for (let i = 0; i < photos.length; i++) {
      if (!photos[i]!.fileId) {
        photos[i] = { ...photos[i]!, fileId: await upload(transport, item, photos[i]!, `${item.id}:file:${i}`) };
        await save({ ...item, payload: { ...item.payload, photos } });
      }
    }
    const done = await transport<{ alreadyCompleted?: boolean; completedBy?: { name: string } | null }>("POST", `/jobs/${item.payload.jobId}/milestones/${item.payload.milestoneId}/complete`, {
      body: { completionNotes: item.payload.completionNotes, photoFileIds: photos.map((p) => p.fileId!) },
      idempotencyKey: item.id,
    });
    return { ...item, payload: { ...item.payload, photos }, result: { alreadyCompleted: Boolean(done.alreadyCompleted), alreadyCompletedBy: done.completedBy?.name ?? null } };
  } catch (error) {
    if (error instanceof RejectedError) throw error;
    if (classify(error) === "rejected") throw new RejectedError(rejectionMessage(item, error));
    throw error;
  }
}
