"use client";

import { placeOfSupplyLabel, SUPPLY_TYPE_LABELS, type EmailOverride } from "@spine/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Breadcrumb,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Card,
  RichTextContent,
  Spinner,
  useConfirm,
} from "@spine/ui";
import { CalendarDays, ChevronDown, Clock, Download, GitBranch, HardHat, Link2, MapPin, Pencil, Receipt, Send, User, XCircle } from "lucide-react";
import Link from "next/link";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { useModule, useModules } from "../../../lib/modules-context";
import { EmailQueueDialog } from "./email-queue-dialog";
import { SaveBundleDialog } from "./save-bundle-dialog";
import { AcceptancePanel } from "./acceptance-panel";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";
import { useEntityToast } from "./entity-toast";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { QuoteActivity } from "./quote-activity";
import { DocumentLinesTable } from "../../../components/document-lines-table";
import { QuoteRelated } from "./quote-related";
import { copyCustomerLink } from "./quote-row-actions";
import { STATUS_BADGE_CLASS, ViewedChip } from "./quotes-table";
import { calendarDate, shortDate, validityNote } from "./quotes-list-state";
import { AttachmentsSection } from "../../../components/attachments-section";

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
    jobs: { id: string; name: string; number?: string | null }[];
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
  // D-217: revising, converting and approving ask first (`confirm` is taken by the conversion guard's retry flag below).
  const { confirm: ask, dialog: confirmDialog } = useConfirm();
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
  // US-QUO-24: anyone who can create quotes may start one from this quote.
  const canDuplicate = useCapability("quotes.edit_own");
  const [historyOpen, setHistoryOpen] = useState(false);
  // US-QUO-25: saving lines as a bundle creates a catalogue record.
  const canSaveBundle = useCapability("catalog.edit_own");
  const [bundleOpen, setBundleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Bumped after "Copy customer link" so Activity shows it.
  const [activityKey, setActivityKey] = useState(0);
  // US-QUO-29/35: a row's menu or "Save and send" opens a quote with ?action=send (or convert-invoice, convert-job).
  const searchParams = useSearchParams();
  const action = useRef(searchParams.get("action"));

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

  // US-SET-21: "Send Quote" and "Email again" open the send dialog, which starts from the Quote email template.
  const [sendDialog, setSendDialog] = useState<"send" | "resend" | null>(null);
  // US-SET-24: no jobs while Jobs & field is switched off.
  const jobsOn = useModule("jobsField");
  const approvalsOn = useModules().modules?.approvals !== false;

  async function handleMarkAsSent(email: EmailOverride) {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Quote>(`/quotes/${quote.id}/send`, email);
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
      throw err;
    } finally {
      setBusy(false);
    }
  }

  /** US-QUO-24 — opens the new draft straight away. */
  async function handleDuplicate() {
    if (!quote) return;
    setBusy(true);
    try {
      const copy = await apiClient.post<Quote>(`/quotes/${quote.id}/duplicate`);
      router.push(`/quotes/${copy.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate this quote.");
      setBusy(false);
    }
  }

  /** US-QUO-24 — "Email again" re-sends the quote email; the page polls while it's pending. */
  async function handleEmailAgain(email: EmailOverride) {
    if (!quote) return;
    setBusy(true);
    try {
      setQuote(await apiClient.post<Quote>(`/quotes/${quote.id}/resend`, email));
      showToast("Email queued", `Quote ${quote.number ?? ""} is being emailed to ${quote.contactName ?? "the contact"} again.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email this quote again.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    if (!quote) return;
    if (!(await ask({ title: "Revise this quote?", description: `${quote.number ?? "This quote"} version ${quote.version + 1} is made as a draft from this one. Once it's sent, this version is superseded and the customer can only answer the newest.`, confirmLabel: "Revise quote" }))) return;
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
    if (
      !confirm &&
      !(await ask({
        title: "Convert to an invoice?",
        description: `A draft invoice for ${formatMoney(BigInt(quote.totalAmount), quote.currency)} is made for ${quote.contactName ?? "the customer"} from ${quote.number ?? "this quote"}'s lines. Nothing is issued or posted until you issue it.`,
        confirmLabel: "Convert to invoice",
      }))
    )
      return;
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
    if (
      !confirm &&
      !(await ask({
        title: "Convert to a job?",
        description: `A job is made for ${quote.contactName ?? "the customer"} with a contract value of ${formatMoney(BigInt(quote.totalAmount), quote.currency)} from ${quote.number ?? "this quote"}. You set up its milestones next.`,
        confirmLabel: "Convert to job",
      }))
    )
      return;
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
    if (
      !(await ask({
        title: "Approve this discount?",
        description: `${quote.number ?? "This quote"}'s discount, above your approval threshold, is approved in your name, and the quote can then be sent.`,
        confirmLabel: "Approve discount",
      }))
    )
      return;
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

  // Runs the action a link asked for, once the quote has loaded, then drops it from the address.
  useEffect(() => {
    if (!quote || !action.current) return;
    const next = action.current;
    action.current = null;
    window.history.replaceState(null, "", window.location.pathname);
    if (next === "send" && quote.status === "draft") setSendDialog("send");
    else if (next === "convert-invoice" && quote.status === "accepted") void handleConvertToInvoice();
    else if (next === "convert-job" && quote.status === "accepted") void handleConvertToJob();
  }, [quote]);

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

  // Each combines the status-based rule with the matching own/others (or
  // dedicated) capability. UI convenience only; QuotesService enforces the
  // same rules server-side regardless of what's shown here.
  const canEdit = quote.status === "draft" && hasEditCapability;
  const canDelete = quote.status === "draft" && hasDeleteCapability;
  const canSendQuote = quote.status === "draft" && hasSendCapability;
  const canRevise = quote.status !== "draft" && !quote.isSuperseded && hasReviseCapability;
  // S-03.10 — a quote can become a job, an invoice, or both.
  const canConvertToInvoice = quote.status === "accepted";
  const canConvertToJob = quote.status === "accepted" && hasCreateJobCapability && jobsOn;
  // D-154: with Approvals switched off, discounts need no approval.
  const needsApproval = quote.discountRequiresApproval && !quote.approvedByUserId && approvalsOn;
  const current = !quote.isSuperseded;
  const canCopyLink = quote.status === "sent" && current && hasSendCapability;
  const locale = orgLocaleTag();
  const today = new Date();
  const validity = validityNote(quote, today, locale);

  // US-QUO-31: one primary button — the next step for the quote's status.
  type Action = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string; external?: boolean };
  const pdf: Action = { key: "pdf", label: quote.status === "draft" ? "Preview PDF" : "Download PDF", icon: <Download size={14} aria-hidden />, href: quotePdfUrl(quote.id), external: true };
  let primary: Action | null = null;
  const secondary: Action[] = [];
  if (quote.status === "draft") {
    if (canSendQuote && !needsApproval) primary = { key: "send", label: "Send quote", icon: <Send size={14} aria-hidden />, onClick: () => setSendDialog("send") };
    if (canEdit) secondary.push({ key: "edit", label: "Edit", icon: <Pencil size={14} aria-hidden />, href: `/quotes/${quote.id}/edit` });
    secondary.push(pdf);
  } else if (quote.status === "sent" && !quote.isExpired && current) {
    if (canCopyLink) primary = { key: "link", label: "Copy customer link", icon: <Link2 size={14} aria-hidden />, onClick: () => void copyCustomerLink(quote.id, (t, d) => { showToast(t, d); setActivityKey((k) => k + 1); }) };
    secondary.push(pdf);
    if (canRevise) secondary.push({ key: "revise", label: "Revise", icon: <GitBranch size={14} aria-hidden />, onClick: () => void handleRevise() });
  } else if (quote.status === "accepted") {
    if (canConvertToInvoice) primary = { key: "invoice", label: "Convert to invoice", icon: <Receipt size={14} aria-hidden />, onClick: () => void handleConvertToInvoice() };
    secondary.push(pdf);
    if (canConvertToJob) secondary.push({ key: "job", label: "Convert to job", icon: <HardHat size={14} aria-hidden />, onClick: () => void handleConvertToJob() });
  } else {
    // Declined, expired or superseded: revise it into a new version.
    if (canRevise) primary = { key: "revise", label: "Revise", icon: <GitBranch size={14} aria-hidden />, onClick: () => void handleRevise() };
    secondary.push(pdf);
  }

  const renderAction = (a: Action, variant: "primary" | "secondary") =>
    a.href ? (
      <Button key={a.key} variant={variant} asChild>
        {a.external ? (
          <a href={a.href} target="_blank" rel="noreferrer">
            {a.icon}
            {a.label}
          </a>
        ) : (
          <Link href={a.href}>
            {a.icon}
            {a.label}
          </Link>
        )}
      </Button>
    ) : (
      <Button key={a.key} variant={variant} onClick={a.onClick} disabled={busy}>
        {busy && variant === "primary" ? <Spinner size="sm" /> : a.icon}
        {a.label}
      </Button>
    );

  return (
    <div className="flex flex-col gap-5">
      {/* US-QUO-31: the number is the page title; the breadcrumb leads back to Quotes. */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: quote.number ?? "Draft quote" }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{quote.number ?? "Draft quote"}</h1>
              <Badge className={STATUS_BADGE_CLASS[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
              {quote.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
              <ViewedChip quote={quote} now={today} />
            </div>
            {quote.title && (
              <p className="text-[15px] font-medium text-on-surface" data-testid="quote-title">
                {quote.title}
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="quote-meta">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                <Link href={`/contacts/${quote.contactId}`} className="font-medium text-primary hover:underline">
                  {quote.contactName ?? "Unknown contact"}
                </Link>
              </span>
              {quote.sentAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} aria-hidden />
                  Sent {shortDate(quote.sentAt, today, locale)}
                </span>
              )}
              {quote.validUntil && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden />
                  Valid until {calendarDate(quote.validUntil, today, locale)}
                  {validity.text && quote.status !== "accepted" && quote.status !== "rejected" && (
                    <>
                      {" · "}
                      <span className={validity.tone === "soon" ? "font-medium text-due-soon" : validity.tone === "gone" ? "font-medium text-overdue" : ""}>{validity.text}</span>
                    </>
                  )}
                </span>
              )}
              {/* US-TAX-13: the place of supply snapshotted on the document. */}
              {quote.placeOfSupply && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  {placeOfSupplyLabel(quote.placeOfSupply)}
                  {quote.supplyType ? ` (${SUPPLY_TYPE_LABELS[quote.supplyType].toLowerCase()})` : ""}
                </span>
              )}
              <span>Version {quote.version}</span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="quote-actions">
            {secondary.map((a) => renderAction(a, "secondary"))}
            {primary && renderAction(primary, "primary")}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" disabled={busy}>
                  More <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canDuplicate && <DropdownMenuItem onSelect={handleDuplicate}>Duplicate as new draft</DropdownMenuItem>}
                {canSaveBundle && (quote.lines ?? []).some((l) => l.type === "item") && <DropdownMenuItem onSelect={() => setBundleOpen(true)}>Save lines as a bundle…</DropdownMenuItem>}
                {quote.status === "sent" && hasSendCapability && <DropdownMenuItem onSelect={() => setSendDialog("resend")}>Email again</DropdownMenuItem>}
                {canCopyLink && primary?.key !== "link" && (
                  <DropdownMenuItem onSelect={() => void copyCustomerLink(quote.id, showToast)}>Copy customer link</DropdownMenuItem>
                )}
                {canRevise && primary?.key !== "revise" && !secondary.some((a) => a.key === "revise") && <DropdownMenuItem onSelect={() => void handleRevise()}>Revise</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>View history</DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                      Delete draft
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/quotes/${quote.id}/history`} subjectLabel="this quote" open={historyOpen} onOpenChange={setHistoryOpen} />
            <SaveBundleDialog
              open={bundleOpen}
              onOpenChange={setBundleOpen}
              quoteId={quote.id}
              lines={quote.lines ?? []}
              currency={quote.currency}
              onSaved={(bundle) => showToast("Bundle saved", `“${bundle.name}” is in the catalogue under Bundles.`)}
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {quote.isSuperseded && quote.supersededByQuoteId && (
        <Alert variant="info" data-testid="quote-superseded">
          <AlertDescription>
            Superseded by{" "}
            <Link href={`/quotes/${quote.supersededByQuoteId}`} className="font-medium text-primary underline-offset-2 hover:underline">
              v{quote.version + 1}
            </Link>
            . Customers can only answer the newest version.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {needsApproval && (
            <Alert variant={isOwner ? "warning" : "critical"}>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>This quote&apos;s discount is above the business&apos;s approval threshold and needs an owner to approve it before it can be sent.</span>
                {isOwner && (
                  <Button size="sm" onClick={handleApproveDiscount} disabled={busy}>
                    {busy ? <Spinner size="sm" /> : "Approve discount"}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Item 7, user feedback — "was the email sent?" without the Email queue screen. */}
          {quote.emailStatus === "pending" && (
            <p className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
              <Clock size={14} className="shrink-0" />
              Sending email to {quote.contactName ?? "the contact"}…
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

          <AcceptancePanel quote={quote} />

          <DocumentLinesTable doc={quote} testIdPrefix="quote" />

          {(quote.notes || quote.termsAndConditions) && (
            <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {quote.notes && (
                <div>
                  <h3 className="text-[12px] font-semibold text-on-surface-muted">Notes</h3>
                  <RichTextContent html={quote.notes} />
                </div>
              )}
              {quote.termsAndConditions && (
                <div>
                  <h3 className="text-[12px] font-semibold text-on-surface-muted">Terms &amp; conditions</h3>
                  <RichTextContent html={quote.termsAndConditions} />
                </div>
              )}
            </Card>
          )}

          <AttachmentsSection entityType="quote" entityId={quote.id} />
        </div>

        <div className="flex flex-col gap-4">
          <QuoteActivity quoteId={quote.id} status={quote.status} refreshKey={`${quote.updatedAt}-${quote.emailStatus}-${activityKey}`} onViewHistory={() => setHistoryOpen(true)} />
          <QuoteRelated quoteId={quote.id} refreshKey={quote.updatedAt} />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft quote?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the draft. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>
              Delete draft
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Org's `quote_conversion_guard` "warn" setting — see ConversionGuardBody's own doc comment. Only ever shown when a prior job and/or invoice already trace back to this quote. AlertDialog (not Dialog) since this is a pure yes/no confirmation with real consequences (creates a separate, unlinked job/invoice), per that component's own "reach for this when an action can't be undone" doc comment. */}
      <AlertDialog open={conversionConfirm !== null} onOpenChange={(open) => !open && setConversionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This quote has already been converted before</AlertDialogTitle>
            <AlertDialogDescription>
              Converting again creates a separate {conversionConfirm?.action ?? "job"}. The amount isn&apos;t split between them. Only do this if you
              mean to bill or track this quote&apos;s work more than once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* US-QUO-23: each existing job or invoice on its own line, as a link. */}
          {conversionConfirm && (
            <div className="mb-4 flex flex-col gap-3 text-[13px]" data-testid="existing-conversions">
              {conversionConfirm.body.existing.jobs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface">Existing job{conversionConfirm.body.existing.jobs.length > 1 ? "s" : ""}</span>
                  <ul className="flex flex-col gap-1">
                    {conversionConfirm.body.existing.jobs.map((j) => (
                      <li key={j.id}>
                        <Link href={`/jobs/${j.id}`} className="text-primary hover:underline">
                          {j.number ? `${j.number} · ${j.name}` : j.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {conversionConfirm.body.existing.invoices.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface">
                    Existing invoice{conversionConfirm.body.existing.invoices.length > 1 ? "s" : ""}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {conversionConfirm.body.existing.invoices.map((i) => (
                      <li key={i.id}>
                        <Link href={`/invoices/${i.id}`} className="text-primary hover:underline">
                          {i.number ?? "Draft invoice"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            {/* Primary, not danger: this creates something, it doesn't delete (D-058). */}
            <Button
              disabled={busy}
              onClick={() => (conversionConfirm?.action === "invoice" ? handleConvertToInvoice(true) : handleConvertToJob(true))}
            >
              {busy ? <Spinner size="sm" /> : `Convert to ${conversionConfirm?.action} anyway`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendDialog && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setSendDialog(null)}
          title={sendDialog === "send" ? "Send quote" : `Email quote ${quote.number ?? ""} again`.trim()}
          description={quote.contactName ?? undefined}
          draftPath={`/email-drafts/quote/${quote.id}`}
          sendLabel={sendDialog === "send" ? "Send quote" : "Send email"}
          pdfLabel="Attach the quote PDF"
          onSend={(email) => (sendDialog === "send" ? handleMarkAsSent(email) : handleEmailAgain(email))}
        />
      )}
      {confirmDialog}
      {toast}
    </div>
  );
}

