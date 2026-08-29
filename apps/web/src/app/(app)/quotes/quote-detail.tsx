"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  RichTextContent,
  Spinner,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { EmailQueueDialog } from "./email-queue-dialog";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";
import { useEntityToast } from "./entity-toast";

/**
 * Body shape of the 409 QuoteConversionGuardService throws when the org's
 * `quote_conversion_guard` setting is "warn" and this quote already has a
 * prior job/invoice — see that service's own doc comment. `existing` lists
 * what's already there so the confirmation dialog can name it specifically
 * ("2 jobs, 1 invoice"), not just say "are you sure?" with no context.
 */
interface ConversionGuardBody {
  message: string;
  existing: {
    jobs: { id: string; name: string }[];
    invoices: { id: string; number: string | null }[];
  };
}

function isConversionGuardConflict(err: unknown): err is ApiError & { body: ConversionGuardBody } {
  return err instanceof ApiError && err.status === 409 && typeof err.body === "object" && err.body !== null && "existing" in err.body;
}

interface MemberRow {
  userId: string;
  role: string;
}

/**
 * `GET /quotes/:id/pdf` streams a binary PDF, not JSON — `apiClient` always
 * JSON-parses responses, so this opens the route directly in a new tab
 * instead. The browser's own cookie session (same-origin credentials,
 * `credentials: "include"` equivalent for a plain navigation) authenticates
 * the request exactly like every other API call from this app; no signed
 * URL or token is needed since this hits the API origin directly, matching
 * how `business-logo-upload.tsx` already builds `${API_URL}/files/:id}`
 * URLs for the same reason.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
function quotePdfUrl(quoteId: string): string {
  return `${API_URL}/quotes/${quoteId}/pdf`;
}

const STATUS_BADGE_CLASS: Record<Quote["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * Read-only-ish detail view for a quote — full line breakdown, totals, and
 * status. There's no public customer-facing share link yet (Stage 3), so
 * this page is the only place a quote's contents are ever viewed. Offers:
 * Edit (draft only, routes to the builder), Send Quote (draft only — issues
 * the quote, allocates its number, and queues the email; label reads
 * "Send Quote" now that email sending is real, per Stage 2), Revise (sent/
 * accepted/rejected, not yet superseded), and Approve discount (owner only,
 * when `discountRequiresApproval` and not yet approved) — S-03.9's
 * affordance, deliberately a single button rather than a richer approval
 * workflow, per the task brief's own scope note.
 */
export function QuoteDetail({ quoteId, currentUserId }: { quoteId: string; currentUserId: string | null }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conversionConfirm, setConversionConfirm] = useState<{
    action: "invoice" | "job";
    body: ConversionGuardBody;
  } | null>(null);
  const { show: showToast, toast } = useEntityToast();
  const hasEditCapability = useCanEditOwnership(quote?.createdByUserId ?? null, { own: "quotes.edit_own", others: "quotes.edit_others" });
  const hasDeleteCapability = useCanEditOwnership(quote?.createdByUserId ?? null, { own: "quotes.delete_own", others: "quotes.delete_others" });
  const hasSendCapability = useCapability("quotes.send");
  const hasReviseCapability = useCapability("quotes.revise");
  const hasCreateJobCapability = useCapability("jobs.edit_own");

  const load = useCallback(() => {
    apiClient
      .get<Quote>(`/quotes/${quoteId}`)
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quote."));
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Item 7, user feedback — the email is sent by a queued worker, out of
  // band from the request that triggered it (see handleMarkAsSent's own
  // comment), so this page's initial load can catch it mid-"pending".
  // Poll while pending so "was the email sent?" resolves on its own without
  // a manual refresh — stops as soon as the status reaches a terminal
  // "sent"/"failed" (or there's nothing to poll for, e.g. a draft).
  useEffect(() => {
    if (quote?.emailStatus !== "pending") return;
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [quote?.emailStatus, load]);

  useEffect(() => {
    if (!currentUserId) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then((members) => {
        const self = members.find((m) => m.userId === currentUserId);
        setIsOwner(self?.role === "owner");
      })
      .catch(() => {});
  }, [currentUserId]);

  async function handleMarkAsSent() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Quote>(`/quotes/${quote.id}/send`);
      setQuote(updated);
      // The email itself is sent out-of-band via a queued job (pg-boss),
      // never awaited by this request — see quotes.service.ts's `send()`
      // comment for why. This toast can only honestly promise that sending
      // was *queued*, not that it succeeded (SMTP might be unconfigured,
      // or the send might still fail/retry after this response returns).
      showToast(
        "Quote marked as sent",
        updated.contactName
          ? `${updated.number} is now issued, and emailing it to ${updated.contactName} has been queued.`
          : `${updated.number} is now issued, and emailing it to the contact has been queued.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this quote as sent.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const revised = await apiClient.post<Quote>(`/quotes/${quote.id}/revise`);
      router.push(`/quotes/${revised.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revise this quote.");
      setBusy(false);
    }
  }

  /**
   * S-03.10's invoice half — creates a draft invoice from this accepted
   * quote's own snapshot, then navigates there so the user can
   * review/adjust before issuing (same "land on the new draft" pattern as
   * handleRevise). `confirm` is only ever `true` when this is a RETRY
   * after the org's `quote_conversion_guard` "warn" setting rejected the
   * first attempt with a 409 and the user explicitly chose "Convert
   * anyway" in the dialog below — see isConversionGuardConflict's own
   * comment for what that 409 looks like.
   */
  async function handleConvertToInvoice(confirm = false) {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const invoice = await apiClient.post<{ id: string }>(`/invoices/from-quote/${quote.id}`, { confirm });
      setConversionConfirm(null);
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      if (isConversionGuardConflict(err)) {
        setConversionConfirm({ action: "invoice", body: err.body });
        setBusy(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not convert this quote to an invoice.");
      setBusy(false);
    }
  }

  /**
   * S-03.10's job half (S-04.1) — creates a job from this accepted
   * quote's own snapshot (contract value carried over), then navigates
   * there so the user can define milestones/retention before billing
   * starts. Independent of "Convert to invoice" — a quote can become a
   * job, an invoice, or both, per S-03.10's own "job and its first
   * invoice" wording. `confirm` mirrors handleConvertToInvoice's own doc
   * comment.
   */
  async function handleConvertToJob(confirm = false) {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const job = await apiClient.post<{ id: string }>(`/jobs/from-quote/${quote.id}`, { confirm });
      setConversionConfirm(null);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      if (isConversionGuardConflict(err)) {
        setConversionConfirm({ action: "job", body: err.body });
        setBusy(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not convert this quote to a job.");
      setBusy(false);
    }
  }

  async function handleApproveDiscount() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Quote>(`/quotes/${quote.id}/approve-discount`);
      setQuote(updated);
      showToast("Discount approved", "This quote can now be sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this quote's discount.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/quotes/${quote.id}`);
      router.push("/quotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this quote.");
      setBusy(false);
    }
  }

  if (error && !quote) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!quote) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Each combines the status-based rule that was already here with the
  // matching own/others (or dedicated) capability — see this file's own
  // capability hooks above. UI convenience only; QuotesService enforces the
  // same rules server-side regardless of what's shown here.
  const canEdit = quote.status === "draft" && hasEditCapability;
  const canDelete = quote.status === "draft" && hasDeleteCapability;
  const canSendQuote = quote.status === "draft" && hasSendCapability;
  const canRevise = quote.status !== "draft" && !quote.isSuperseded && hasReviseCapability;
  // S-03.10 — both conversions share the same guard (only an accepted
  // quote is convertible) and are independent actions, not mutually
  // exclusive: a quote can become a job, an invoice, or both.
  const canConvertToInvoice = quote.status === "accepted";
  const canConvertToJob = quote.status === "accepted" && hasCreateJobCapability;
  const needsApproval = quote.discountRequiresApproval && !quote.approvedByUserId;

  return (
    <div className="flex flex-col gap-6">
      {/* Explicit back button, matching contact-detail.tsx's exact pattern
          (the AppShellHeader breadcrumb above this component already offers
          "Quotes", but a one-click back affordance next to the identity it
          returns from reads clearer for a detail page one level deep). */}
      <button
        type="button"
        onClick={() => router.push("/quotes")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to quotes
      </button>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-on-surface">{quote.number ?? "Draft quote"}</h2>
              <Badge className={STATUS_BADGE_CLASS[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
              {quote.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
              {quote.isSuperseded && <Badge className="bg-draft-bg text-draft">Superseded by v{quote.version + 1}</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-on-surface-muted">
              {quote.contactName ?? "Unknown contact"} · Version {quote.version}
              {quote.validUntil && <> · Valid until {new Date(quote.validUntil).toLocaleDateString()}</>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HistorySection endpoint={`/quotes/${quote.id}/history`} subjectLabel="this quote" />
            {/* PRD S-03.3 — live preview/download, rendered on demand from the quote's current snapshot (see quotes.controller.ts's GET /:id/pdf comment for why this is always a live render, even for a sent quote). `target="_blank"` opens the browser's native PDF viewer rather than forcing a download, matching how most PDF "preview" affordances behave; the browser's own Save/Download control still lets a user save it if they want the file. */}
            <Button variant="secondary" asChild>
              <a href={quotePdfUrl(quote.id)} target="_blank" rel="noreferrer">
                {quote.status === "draft" ? "Preview PDF" : "Download PDF"}
              </a>
            </Button>
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/quotes/${quote.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canSendQuote && !needsApproval && (
              <Button onClick={handleMarkAsSent} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Send Quote"}
              </Button>
            )}
            {canRevise && (
              <Button onClick={handleRevise} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Revise"}
              </Button>
            )}
            {canConvertToInvoice && (
              <Button onClick={() => handleConvertToInvoice()} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Convert to invoice"}
              </Button>
            )}
            {canConvertToJob && (
              <Button variant="secondary" onClick={() => handleConvertToJob()} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Convert to job"}
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete draft
              </Button>
            )}
          </div>
        </div>

        {needsApproval && (
          <Alert variant={isOwner ? "warning" : "critical"}>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>This quote's discount is above the org's approval threshold and needs owner sign-off before it can be sent.</span>
              {isOwner && (
                <Button size="sm" onClick={handleApproveDiscount} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Approve discount"}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {quote.approvedByUserId && (
          <p className="text-[13px] text-on-surface-muted">
            Discount approved {quote.approvedAt ? new Date(quote.approvedAt).toLocaleString() : ""}.
          </p>
        )}

        {/* Item 7, user feedback — "was the email sent?" without needing the
            Email queue screen. Nothing renders on a draft (emailStatus is
            null until Send Quote is clicked). */}
        {quote.emailStatus === "pending" && (
          <p className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
            <Clock size={14} className="shrink-0" />
            Sending email to {quote.contactName ?? "the contact"}…
          </p>
        )}
        {quote.emailStatus === "sent" && (
          <p className="flex items-center gap-1.5 text-[13px] text-paid">
            <CheckCircle2 size={14} className="shrink-0" />
            Emailed to {quote.contactName ?? "the contact"}
            {quote.emailSentAt && <> on {new Date(quote.emailSentAt).toLocaleString()}</>}.
          </p>
        )}
        {quote.emailStatus === "failed" && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-medium">
                <XCircle size={14} className="shrink-0" />
                Email delivery failed
              </span>
              {quote.emailError && <span className="text-[13px]">{quote.emailError}</span>}
              <span className="text-[13px]">
                <EmailQueueDialog
                  trigger={
                    <button type="button" className="underline hover:text-on-surface">
                      Check the email queue
                    </button>
                  }
                />{" "}
                — a retry may still be in progress.
              </span>
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-on-surface">Lines</h3>
        <div className="flex flex-col divide-y divide-border">
          {(quote.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className={line.type === "heading" ? "font-semibold text-on-surface" : "text-on-surface"}>{line.name}</p>
                {line.description && <p className="text-[13px] text-on-surface-muted">{line.description}</p>}
                {line.type === "item" && (
                  <p className="text-[12px] text-on-surface-muted">
                    {line.quantity} × {toDecimalString({ amount: BigInt(line.unitPriceAmount), currency: quote.currency })}
                    {line.discountPercentage > 0 && <> · {line.discountPercentage}% off</>}
                    {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
                  </p>
                )}
              </div>
              {line.type === "item" && (
                <span className="shrink-0 font-mono tabular-nums text-on-surface">
                  {toDecimalString({ amount: BigInt(line.lineTotalAmount), currency: quote.currency })}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <TotalRow label="Subtotal" value={quote.subtotalAmount} currency={quote.currency} />
        <TotalRow label="Discount" value={`-${toDecimalString({ amount: BigInt(quote.discountAmount), currency: quote.currency })}`} currency="" raw />
        <TotalRow label="Tax" value={quote.taxAmount} currency={quote.currency} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={quote.totalAmount} currency={quote.currency} emphasize />
        </div>
      </Card>

      {(quote.notes || quote.termsAndConditions) && (
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quote.notes && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
              <RichTextContent html={quote.notes} />
            </div>
          )}
          {quote.termsAndConditions && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Terms & conditions</h3>
              <RichTextContent html={quote.termsAndConditions} />
            </div>
          )}
        </Card>
      )}

      {/* Org's `quote_conversion_guard` "warn" setting — see ConversionGuardBody's own doc comment. Only ever shown when a prior job and/or invoice already trace back to this quote. AlertDialog (not Dialog) since this is a pure yes/no confirmation with real consequences (creates a separate, unlinked job/invoice), per that component's own "reach for this when an action can't be undone" doc comment. */}
      <AlertDialog open={conversionConfirm !== null} onOpenChange={(open) => !open && setConversionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This quote has already been converted before</AlertDialogTitle>
            <AlertDialogDescription>
              {conversionConfirm && (
                <>
                  {conversionConfirm.body.existing.jobs.length > 0 && (
                    <>
                      Existing job{conversionConfirm.body.existing.jobs.length > 1 ? "s" : ""}:{" "}
                      {conversionConfirm.body.existing.jobs.map((j) => j.name).join(", ")}
                      {conversionConfirm.body.existing.invoices.length > 0 && ". "}
                    </>
                  )}
                  {conversionConfirm.body.existing.invoices.length > 0 && (
                    <>
                      Existing invoice{conversionConfirm.body.existing.invoices.length > 1 ? "s" : ""}:{" "}
                      {conversionConfirm.body.existing.invoices.map((i) => i.number ?? "draft").join(", ")}.
                    </>
                  )}{" "}
                  Converting again will create a SEPARATE {conversionConfirm.action}, in addition to the one(s) above — the
                  amount is not split between them. Only do this if you actually mean to bill or track this quote's work
                  more than once.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => (conversionConfirm?.action === "invoice" ? handleConvertToInvoice(true) : handleConvertToJob(true))}
            >
              {busy ? <Spinner size="sm" /> : `Convert to ${conversionConfirm?.action} anyway`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast}
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  emphasize,
  raw,
}: {
  label: string;
  value: string;
  currency: string;
  emphasize?: boolean;
  raw?: boolean;
}) {
  const display = raw ? value : `${toDecimalString({ amount: BigInt(value), currency })} ${currency}`;
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${emphasize ? "text-[16px] font-bold text-on-surface" : "text-[14px] text-on-surface"}`}>
        {display}
      </span>
    </div>
  );
}
