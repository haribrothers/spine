import { useCallback, useEffect, useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import { cache } from "../cache/cache-store";
import { connectivity } from "../connectivity";
import { OfflineError } from "../api/errors";
import { newIdempotencyKey } from "../api/idempotency";
import { useSession } from "../session/session-provider";
import { encodePng, rasterize, type Stroke } from "../signature/png";
import { quotesKey, type QuoteToPresent } from "./jobs";
import { t } from "../i18n";

/** A quote as it's presented to the customer (US-MOB-16: `GET /quotes/:id`). */
export interface PresentedQuote {
  id: string;
  number: string | null;
  status: "draft" | "sent" | "accepted" | "rejected";
  contactName: string | null;
  currency: string;
  validUntil: string | null;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes: string | null;
  business: { name: string; address: string | null };
  /** Each tax as printed: "Sales Tax (15%)", or CGST and SGST in India. */
  taxLines: { label: string; amount: string }[];
  lines: PresentedLine[];
  respondedAt: string | null;
  acceptedSignerName: string | null;
  acceptedByName: string | null;
}

export interface PresentedLine {
  id: string;
  type: "item" | "heading" | "text";
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  lineSubtotalAmount: string;
}

export type LiveQuote = { status: "loading" } | { status: "offline" } | { status: "error"; message: string } | { status: "ready"; quote: PresentedQuote };

/**
 * D-050 / US-MOB-18 — a quote to present is always read live, never from
 * the phone's cache: accepting locks the price, so it must be the office's
 * current one. Offline (or no answer from the phone's network) is
 * "Quotes need a connection".
 */
export function useLiveQuote(id: string): LiveQuote & { retry: () => void } {
  const { request } = useSession();
  const [state, setState] = useState<LiveQuote>({ status: "loading" });
  const live = useRef(true);

  const load = useCallback(async () => {
    if (!connectivity.get()) {
      setState({ status: "offline" });
      return;
    }
    setState({ status: "loading" });
    try {
      const quote = await request<PresentedQuote>("GET", `/quotes/${id}`);
      if (live.current) setState({ status: "ready", quote });
    } catch (error) {
      if (!live.current) return;
      setState(error instanceof OfflineError ? { status: "offline" } : { status: "error", message: error instanceof Error ? error.message : t("mobileApp.quote.loadFailed") });
    }
  }, [id, request]);

  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, [load]);

  return { ...state, retry: () => void load() };
}

/** The signature pad's strokes, saved as a PNG in the cache folder for upload. */
export function signatureFile(strokes: readonly Stroke[], size: { width: number; height: number }): File {
  const png = encodePng(rasterize(strokes, size));
  const file = new File(Paths.cache, `signature-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(png);
  return file;
}

type Request = ReturnType<typeof useSession>["request"];

/** US-MOB-17 — uploads the signature, then records the acceptance (US-QUO-19). One idempotency key per tap. */
export async function acceptQuote(request: Request, id: string, input: { signerName: string; signature: File }): Promise<PresentedQuote> {
  const key = newIdempotencyKey();
  const form = new FormData();
  form.append("file", input.signature as unknown as Blob, "signature.png");
  const uploaded = await request<{ id: string }>("POST", "/files", { formData: form, idempotencyKey: `${key}:signature` });
  try {
    input.signature.delete();
  } catch {
    // The cache folder is cleared by the system anyway.
  }
  return request<PresentedQuote>("POST", `/quotes/${id}/accept-in-person`, { body: { signatureFileId: uploaded.id, signerName: input.signerName.trim() }, idempotencyKey: key });
}

/** US-MOB-16 — records the customer's decline, with their reason if they gave one. */
export function declineQuote(request: Request, id: string, reason: string): Promise<PresentedQuote> {
  return request<PresentedQuote>("POST", `/quotes/${id}/reject-in-person`, { body: { comment: reason.trim() || null }, idempotencyKey: newIdempotencyKey() });
}

/** Once answered, a quote leaves the job's "Quotes to present" straight away. */
export async function forgetPresented(jobId: string | undefined, quoteId: string): Promise<void> {
  if (!jobId) return;
  const saved = await cache.read<QuoteToPresent[]>(quotesKey(jobId));
  if (saved) await cache.write(quotesKey(jobId), saved.value.filter((q) => q.id !== quoteId));
}

/**
 * The quote on screen, shared by the present, accept, accepted and decline
 * screens of one presentation (they're separate routes in the quote
 * modal). Lives only in memory: a presentation always starts from a live
 * read.
 */
const presenting = new Map<string, { quote: PresentedQuote; jobId?: string; answer?: PresentedQuote }>();

export const presentation = {
  start(quote: PresentedQuote, jobId: string | undefined) {
    presenting.set(quote.id, { quote, jobId });
  },
  get(id: string) {
    return presenting.get(id) ?? null;
  },
  answered(answer: PresentedQuote) {
    const entry = presenting.get(answer.id);
    if (entry) presenting.set(answer.id, { ...entry, answer });
  },
  end(id: string) {
    presenting.delete(id);
  },
};
