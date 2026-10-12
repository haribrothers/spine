"use client";

import { DEFAULT_INVOICE_DUE_DAYS, dueDateFor, gstinRequired, missingHsnSacMessage, placeOfSupplyLabel, resolveDocumentLayout, SUPPLY_TYPE_LABELS, type DocumentLayout, type GstTreatment, type EmailOverride } from "@spine/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Breadcrumb,
  Button,
  Card,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Input,
  RichTextContent,
  Spinner,
} from "@spine/ui";
import { Banknote, Bell, CalendarDays, ChevronDown, Clock, Download, HardHat, MapPin, Pencil, Receipt, Send, User } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { ApplyCustomerCreditDialog } from "./apply-customer-credit-dialog";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { loadCustomerCredit } from "../../../lib/customer-credit";
import { CreateCreditNoteDialog, creditNoteIssuedToast } from "./create-credit-note-dialog";
import { CreditNotesSection } from "./credit-notes-section";
import { useToast } from "../../../components/toast-host";
import { PaymentsSection } from "./payments-section";
import { RecordPaymentDialog } from "../../../components/record-payment-dialog";
import type { Invoice } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { AttachmentsSection } from "../../../components/attachments-section";
import { DocumentLinesTable, type AfterTotalRow } from "../../../components/document-lines-table";
import { InvoiceActivity } from "./invoice-activity";
import { STATE_BADGE_CLASS } from "./invoices-table";
import { INVOICE_STATE_LABELS, dueNote, invoiceState } from "./invoices-list-state";
import { EmailFailedAlert } from "../../../components/email-failed-alert";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";

import { SectionLink } from "../../../components/section-link";
/**
 * `GET /invoices/:id/pdf` streams a binary PDF, not JSON — `apiClient`
 * always JSON-parses responses, so this opens the route directly in a new
 * tab instead, matching quotes/quote-detail.tsx's own `quotePdfUrl`.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
function invoicePdfUrl(invoiceId: string): string {
  return `${API_URL}/invoices/${invoiceId}/pdf`;
}

/**
 * An invoice's page. US-INV-30 (D-217): the number is the title, with its
 * status, customer, dates and where it came from; one primary button is the
 * next step (Issue invoice, Send reminder, Record payment, else Download
 * PDF), the rest beside it or under More; once issued a strip reads Total,
 * Paid, Retention held or Credited, and Balance due. US-INV-31: the lines
 * as a table with the totals, Paid and Balance due under them, then
 * payments, credit notes and attachments. US-INV-32: Activity beside them.
 * `?action=issue|pay|email|remind|void` (from a row's menu or "Save and
 * issue") opens that step; `?duplicated=` is handled by the builder.
 */
export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [creditNotesRefreshKey, setCreditNotesRefreshKey] = useState(0);
  const showToast = useToast();

  const hasEditCapability = useCanEditOwnership(invoice?.createdByUserId ?? null, { own: "invoices.edit_own", others: "invoices.edit_others" });
  const hasDeleteCapability = useCanEditOwnership(invoice?.createdByUserId ?? null, { own: "invoices.delete_own", others: "invoices.delete_others" });
  const hasIssueCapability = useCapability("invoices.issue");
  const hasVoidCapability = useCapability("invoices.void");
  const hasSendCapability = useCapability("invoices.send");
  const hasSendReminderCapability = useCapability("invoices.send_reminder");
  const hasRecordPaymentCapability = useCapability("payments.edit_own");
  const hasIssueCreditNoteCapability = useCapability("credit_notes.issue");
  const hasApplyCreditCapability = useCapability("payments.apply_credit");
  // US-PAY-16: the customer's credit from payments and credit notes, for "Apply credit".
  const [applyCreditOpen, setApplyCreditOpen] = useState(false);
  const [customerCredit, setCustomerCredit] = useState<bigint>(0n);
  const hasDuplicateCapability = useCapability("invoices.edit_own");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // US-INV-33: a draft without a due date says when it will be due, from the payment terms.
  const [dueDays, setDueDays] = useState(DEFAULT_INVOICE_DUE_DAYS);
  const searchParams = useSearchParams();
  const action = useRef(searchParams.get("action"));

  const load = useCallback(() => {
    apiClient
      .get<Invoice>(`/invoices/${invoiceId}`)
      .then(setInvoice)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load invoice."));
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  // US-PAY-16: whether this customer holds credit to apply, reloaded with the invoice.
  useEffect(() => {
    if (!invoice?.contactId || !hasApplyCreditCapability) return;
    loadCustomerCredit(invoice.contactId)
      .then((credits) => setCustomerCredit(credits.reduce((sum, c) => sum + c.available, 0n)))
      .catch(() => setCustomerCredit(0n));
  }, [invoice, hasApplyCreditCapability]);

  useEffect(() => {
    if (invoice?.status !== "draft" || invoice.dueDate) return;
    apiClient
      .get<{ value: DocumentLayout | null }>("/org/settings/document_layout")
      .then((res) => setDueDays(resolveDocumentLayout(res.value, "invoice").dueDays))
      .catch(() => undefined);
  }, [invoice?.status, invoice?.dueDate]);

  // S-05.7's email is sent by a queued worker, out of band from the
  // request that triggered it (see handleSendEmail's own comment) — same
  // polling pattern as quote-detail.tsx's own emailStatus effect, so "was
  // it sent?" resolves on its own without a manual refresh.
  useEffect(() => {
    if (invoice?.emailStatus !== "pending") return;
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [invoice?.emailStatus, load]);

  // US-INV-29/34: a row's menu or "Save and issue" opens the invoice with ?action= — once, then the address is cleaned.
  useEffect(() => {
    const next = action.current;
    if (!invoice || !next) return;
    action.current = null;
    router.replace(`/invoices/${invoice.id}`, { scroll: false });
    if (next === "issue" && invoice.status === "draft") void requestIssue();
    else if (next === "pay" && invoice.status === "issued" && BigInt(invoice.balanceDue) > 0n) setPaymentOpen(true);
    else if (next === "email" && invoice.status === "issued") setSendDialog("invoice");
    else if (next === "remind" && invoice.isOverdue) setSendDialog("reminder");
    else if (next === "void" && invoice.status === "issued") setVoidOpen(true);
    // Runs once, when the invoice first loads (action.current is cleared).
  }, [invoice]);

  // US-TAX-14 — lines without an HSN/SAC code on an invoice to a registered business.
  const [missingHsn, setMissingHsn] = useState(0);

  async function requestIssue() {
    if (!invoice) return;
    const missing = (invoice.lines ?? []).filter((l) => l.type === "item" && !l.hsnSac).length;
    if (missing > 0) {
      const contact = await apiClient.get<{ gstTreatment: GstTreatment | null }>(`/contacts/${invoice.contactId}?picker=1`).catch(() => null);
      if (gstinRequired(contact?.gstTreatment)) {
        setMissingHsn(missing);
        return;
      }
    }
    await offerCreditOrIssue(false);
  }

  // Issuing can't be undone (a permanent number, posted to the books), so it's always confirmed: by the
  // HSN/SAC or credit question when one is asked, else by "Issue this invoice?".
  const [confirmIssue, setConfirmIssue] = useState(false);

  // D-187 — the customer's credit (a deposit, a credit note), offered before issuing so the PDF's UPI QR asks for what's left.
  const [creditOffer, setCreditOffer] = useState<bigint>(0n);

  async function offerCreditOrIssue(confirmed: boolean) {
    if (!invoice) return;
    setMissingHsn(0);
    if (hasApplyCreditCapability && invoice.type !== "advance") {
      const credit = await apiClient.get<{ amount: string }>(`/invoices/${invoice.id}/available-credit`).catch(() => ({ amount: "0" }));
      if (BigInt(credit.amount) > 0n) {
        setCreditOffer(BigInt(credit.amount));
        return;
      }
    }
    if (confirmed) await handleIssue(false);
    else setConfirmIssue(true);
  }

  const issueWithCredit = () => handleIssue(true);
  // The HSN/SAC question's "Issue anyway" is the confirmation, so the credit offer (if any) follows, not a second question.
  const issueAnyway = () => offerCreditOrIssue(true);

  async function handleIssue(applyCredit: boolean) {
    if (!invoice) return;
    setMissingHsn(0);
    setConfirmIssue(false);
    setCreditOffer(0n);
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/issue`, applyCredit ? { applyCredit: true } : undefined);
      setInvoice(updated);
      const applied = BigInt(updated.amountPaid ?? "0") + BigInt(updated.creditedAmount ?? "0");
      if (applied > 0n) setPaymentsRefreshKey((key) => key + 1);
      showToast(
        "Invoice issued",
        applied > 0n
          ? `${updated.number} has been issued and posted to the ledger. ${formatMoney(applied, updated.currency)} of credit was applied.`
          : `${updated.number} has been issued and posted to the ledger.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue this invoice.");
    } finally {
      setBusy(false);
    }
  }

  // US-SET-21: "Email invoice" and "Send reminder" open the send dialog, starting from their templates.
  const [sendDialog, setSendDialog] = useState<"invoice" | "reminder" | null>(null);

  async function handleSendEmail(email: EmailOverride) {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/send-email`, email);
      setInvoice(updated);
      showToast(
        "Emailing invoice",
        updated.contactName
          ? `Sending ${updated.number} to ${updated.contactName} has been queued.`
          : `Sending ${updated.number} has been queued.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email this invoice.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReminder(email: EmailOverride) {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/send-reminder`, email);
      setInvoice(updated);
      showToast(
        "Reminder sent",
        updated.contactName ? `A reminder for ${updated.number} has been queued to ${updated.contactName}.` : `A reminder for ${updated.number} has been queued.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this reminder.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    if (!invoice) return;
    if (!voidReason.trim()) {
      setVoidError("A reason is required to void an invoice.");
      return;
    }
    setBusy(true);
    setVoidError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/void`, { reason: voidReason.trim() });
      setInvoice(updated);
      setVoidOpen(false);
      setVoidReason("");
      showToast("Invoice voided", `${updated.number} has been voided and a reversing entry posted.`);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Could not void this invoice.");
    } finally {
      setBusy(false);
    }
  }

  // US-INV-35 — a new draft from this invoice, opened in the builder.
  async function handleDuplicate() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await apiClient.post<Invoice>(`/invoices/${invoice.id}/duplicate`);
      router.push(`/invoices/${copy.id}/edit?duplicated=${encodeURIComponent(invoice.number ?? "")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't duplicate this invoice.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/invoices/${invoice.id}`);
      showToast("Invoice deleted", `${invoice.number ?? "Draft invoice"} has been permanently removed.`);
      router.push("/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this invoice.");
      setBusy(false);
    }
  }

  if (error && !invoice) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!invoice) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const canEdit = invoice.status === "draft" && hasEditCapability;
  const canDelete = invoice.status === "draft" && hasDeleteCapability;
  const canIssue = invoice.status === "draft" && hasIssueCapability;
  const canVoid = invoice.status === "issued" && hasVoidCapability && invoice.type !== "opening";
  const canSendEmail = invoice.status === "issued" && hasSendCapability && invoice.type !== "opening";
  const canSendReminder = invoice.isOverdue && hasSendReminderCapability;
  // US-INV-35: anyone who can create invoices may start one from this one; an opening balance has nothing to copy.
  const canDuplicate = hasDuplicateCapability && invoice.type !== "opening";
  const balanceDue = BigInt(invoice.balanceDue);
  const amountPaid = BigInt(invoice.amountPaid);
  const retentionAmount = BigInt(invoice.retentionAmount);
  // S-05.4 — an advance invoice never posts to AR on issue (see
  // InvoicesService.issue's own doc comment), so it has no real ledger
  // balance to record a payment or credit note against — that money
  // flows through PaymentsService.create's own "Advance received"
  // posting (S-06.4, record the deposit as an unallocated payment)
  // instead, not through this invoice.
  const canRecordPayment = invoice.status === "issued" && balanceDue > 0n && invoice.type !== "advance" && hasRecordPaymentCapability;
  // US-PAY-16 (D-142): a paid invoice can be credited too; the excess becomes customer credit.
  // US-INV-36: only while something is left to credit on it.
  const canIssueCreditNote = invoice.status === "issued" && invoice.type !== "advance" && invoice.type !== "opening" && hasIssueCreditNoteCapability && BigInt(invoice.leftToCredit ?? invoice.totalAmount) > 0n;
  const canApplyCredit = invoice.status === "issued" && balanceDue > 0n && invoice.type !== "advance" && hasApplyCreditCapability && customerCredit > 0n;
  const creditedAmount = BigInt(invoice.creditedAmount);
  const locale = orgLocaleTag();
  const today = new Date();
  const state = invoiceState(invoice);
  const due = dueNote(invoice, today, locale);
  const money = (v: bigint) => formatMoney(v, invoice.currency);
  // What "Issue this invoice?" says it will be due: its own due date, else issued today (or on its issue date) plus the terms.
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const issueDue = invoice.dueDate?.slice(0, 10) ?? dueDateFor(invoice.issueDate?.slice(0, 10) ?? localToday, dueDays);
  const issueDueLabel = new Date(`${issueDue}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  // US-INV-30: one primary button — the invoice's next step; the rest beside it or under More.
  type Action = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string; external?: boolean };
  // US-RPT-17: an opening invoice has no PDF in Spine — its attachments hold the original.
  const pdf: Action | null =
    invoice.type === "opening" ? null : { key: "pdf", label: invoice.status === "draft" ? "Preview PDF" : "Download PDF", icon: <Download size={14} aria-hidden />, href: invoicePdfUrl(invoice.id), external: true };
  const issueAction: Action = { key: "issue", label: "Issue invoice", icon: <Send size={14} aria-hidden />, onClick: () => void requestIssue() };
  const remindAction: Action = { key: "remind", label: "Send reminder", icon: <Bell size={14} aria-hidden />, onClick: () => setSendDialog("reminder") };
  const payAction: Action = { key: "pay", label: "Record payment", icon: <Banknote size={14} aria-hidden />, onClick: () => setPaymentOpen(true) };
  let primary: Action | null = null;
  const secondary: Action[] = [];
  if (invoice.status === "draft") {
    if (canEdit) secondary.push({ key: "edit", label: "Edit", icon: <Pencil size={14} aria-hidden />, href: `/invoices/${invoice.id}/edit` });
    if (pdf) secondary.push(pdf);
    if (canIssue) primary = issueAction;
  } else if (canSendReminder) {
    if (pdf) secondary.push(pdf);
    if (canRecordPayment) secondary.push(payAction);
    primary = remindAction;
  } else if (canRecordPayment) {
    if (pdf) secondary.push(pdf);
    primary = payAction;
  } else if (pdf) {
    primary = pdf;
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

  // US-INV-30: Total, Paid, Retention held or Credited, Balance due — once issued.
  // D-219: the bar under Paid counts payments only; credit shows under Credited.
  const dueTotal = BigInt(invoice.totalAmount) - retentionAmount;
  const share = dueTotal > 0n ? Math.min(100, Number((amountPaid * 100n) / dueTotal)) : 0;
  const taxNote = (invoice.taxLines ?? []).length === 1 ? `incl. ${invoice.taxLines![0]!.label} ${money(BigInt(invoice.taxLines![0]!.amount))}` : BigInt(invoice.taxAmount) > 0n ? `incl. tax ${money(BigInt(invoice.taxAmount))}` : "No tax";
  const figure = (label: string, value: string, note: React.ReactNode, testId: string, opts: { bar?: number; tone?: string } = {}) => (
    <div key={label} className="flex min-w-0 flex-col gap-1 border-border p-4 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", opts.tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{note}</span>
      {opts.bar !== undefined && (
        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${opts.bar}% paid`}>
          <span className="block h-full rounded-full bg-paid" style={{ width: `${opts.bar}%` }} />
        </span>
      )}
    </div>
  );
  const figures =
    invoice.status === "issued"
      ? [
          figure("Total", money(BigInt(invoice.totalAmount)), taxNote, "fig-total"),
          figure("Paid", money(amountPaid), invoice.lastPaidAt ? `last on ${calendarDate(invoice.lastPaidAt, today, locale)}` : "Nothing yet", "fig-paid", { bar: share }),
          retentionAmount > 0n
            ? figure("Retention held", money(retentionAmount), `${invoice.retention?.percent ?? "0"}%, released from the job`, "fig-retention")
            : creditedAmount > 0n
              ? figure("Credited", money(creditedAmount), "From credit notes and credit", "fig-credited")
              : null,
          figure(
            "Balance due",
            money(balanceDue),
            due.text ? <span className={due.tone === "over" ? "font-medium text-overdue" : due.tone === "soon" ? "font-medium text-due-soon" : due.tone === "paid" ? "font-medium text-paid" : ""}>{due.tone === "" || due.tone === "soon" ? (due.text === "today" ? "Due today" : `Due ${due.text}`) : due.text}</span> : "No due date",
            "fig-balance",
            { tone: invoice.isOverdue ? "text-overdue" : undefined },
          ),
        ].filter(Boolean)
      : [];

  const afterTotal: AfterTotalRow[] = [
    ...(retentionAmount > 0n ? [{ label: `Retention held (${invoice.retention?.percent ?? "0"}%)`, amount: retentionAmount, subtract: true }] : []),
    ...(amountPaid > 0n ? [{ label: "Paid", amount: amountPaid, subtract: true, tone: "paid" as const }] : []),
    ...(creditedAmount > 0n ? [{ label: "Credited", amount: creditedAmount, subtract: true, tone: "paid" as const }] : []),
    ...(invoice.status !== "void" && (retentionAmount > 0n || amountPaid > 0n || creditedAmount > 0n || invoice.status === "issued")
      ? [{ label: "Balance due", amount: balanceDue, tone: invoice.isOverdue ? ("overdue" as const) : ("balance" as const) }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* US-INV-30: the number is the page title; the breadcrumb leads back to Invoices. */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Invoices", href: "/invoices" }, { label: invoice.number ?? "Draft invoice" }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{invoice.number ?? "Draft invoice"}</h1>
              <Badge className={STATE_BADGE_CLASS[state]} data-testid="invoice-state">
                {INVOICE_STATE_LABELS[state]}
              </Badge>
              {invoice.type === "progress" && invoice.progressClaimNo && <Badge className="bg-info-bg text-primary">Progress claim {invoice.progressClaimNo}</Badge>}
              {invoice.type === "advance" && <Badge className="bg-draft-bg text-draft">Deposit</Badge>}
              {invoice.type === "opening" && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
              {invoice.type === "retention_release" && <Badge className="bg-draft-bg text-draft">Retention release</Badge>}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="invoice-meta">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                <SectionLink href={`/contacts/${invoice.contactId}`} className="font-medium text-primary hover:underline">
                  {invoice.contactName ?? "Unknown contact"}
                </SectionLink>
              </span>
              {invoice.status !== "draft" && invoice.issueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} aria-hidden />
                  Issued {calendarDate(invoice.issueDate, today, locale)}
                </span>
              )}
              {invoice.status === "draft" && !invoice.dueDate ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden />
                  Not issued yet · {dueDays === 0 ? "due on receipt" : `due ${dueDays} days after issue`}
                </span>
              ) : (
                invoice.dueDate &&
                state !== "void" && (
                  <span className="inline-flex items-center gap-1.5" data-testid="invoice-due">
                    <CalendarDays size={14} aria-hidden />
                    Due {calendarDate(invoice.dueDate, today, locale)}
                    {due.text && state !== "paid" && (
                      <>
                        {" · "}
                        <span className={due.tone === "over" ? "font-medium text-overdue" : due.tone === "soon" ? "font-medium text-due-soon" : ""}>{due.text}</span>
                      </>
                    )}
                  </span>
                )
              )}
              {/* US-TAX-13: the place of supply snapshotted on the document. */}
              {invoice.placeOfSupply && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  {placeOfSupplyLabel(invoice.placeOfSupply)}
                  {invoice.supplyType ? ` (${SUPPLY_TYPE_LABELS[invoice.supplyType].toLowerCase()})` : ""}
                </span>
              )}
              {/* US-JOB-21: which job and milestone this invoice bills. */}
              {invoice.job && (
                <span className="inline-flex items-center gap-1.5" data-testid="invoice-job-card">
                  <HardHat size={14} aria-hidden />
                  <SectionLink href={`/jobs/${invoice.job.id}`} className="font-medium text-primary hover:underline">
                    {invoice.job.number ? `${invoice.job.number} · ${invoice.job.name}` : invoice.job.name}
                  </SectionLink>
                  {invoice.milestone && (
                    <>
                      {" · "}
                      {invoice.milestone.name}
                      {invoice.milestone.percent !== null && ` (${invoice.milestone.percent}%)`}
                    </>
                  )}
                </span>
              )}
              {invoice.sourceQuoteId && (
                <span className="inline-flex items-center gap-1.5">
                  <Receipt size={14} aria-hidden />
                  From{" "}
                  <SectionLink href={`/quotes/${invoice.sourceQuoteId}`} className="font-medium text-primary hover:underline">
                    {invoice.sourceQuoteNumber ?? "a quote"}
                  </SectionLink>
                </span>
              )}
            </p>
            {/* US-JOB-29 (D-128): the claim number is given at issue. */}
            {invoice.type === "progress" && !invoice.progressClaimNo && invoice.status === "draft" && (
              <p className="text-[12.5px] text-on-surface-muted">Claim number is given when the invoice is issued.</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="invoice-actions">
            {secondary.map((a) => renderAction(a, "secondary"))}
            {primary && renderAction(primary, "primary")}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" disabled={busy}>
                  More <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pdf && primary?.key !== "pdf" && !secondary.some((a) => a.key === "pdf") && (
                  <DropdownMenuItem asChild>
                    <a href={pdf.href} target="_blank" rel="noreferrer">
                      <MENU_ICONS.download aria-hidden />
                      {pdf.label}
                    </a>
                  </DropdownMenuItem>
                )}
                {canSendEmail && (
                  <DropdownMenuItem onSelect={() => setSendDialog("invoice")}>
                    <MENU_ICONS.email aria-hidden />
                    Email invoice
                  </DropdownMenuItem>
                )}
                {canRecordPayment && primary?.key !== "pay" && !secondary.some((a) => a.key === "pay") && (
                  <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>
                    <MENU_ICONS.recordPayment aria-hidden />
                    Record payment
                  </DropdownMenuItem>
                )}
                {canApplyCredit && (
                  <DropdownMenuItem onSelect={() => setApplyCreditOpen(true)}>
                    <MENU_ICONS.applyCredit aria-hidden />
                    Apply credit
                  </DropdownMenuItem>
                )}
                {canIssueCreditNote && (
                  <DropdownMenuItem onSelect={() => setCreditNoteOpen(true)}>
                    <MENU_ICONS.issueCreditNote aria-hidden />
                    Issue credit note
                  </DropdownMenuItem>
                )}
                {canDuplicate && (
                  <DropdownMenuItem onSelect={() => void handleDuplicate()}>
                    <MENU_ICONS.duplicate aria-hidden />
                    Duplicate as new draft
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  View history
                </DropdownMenuItem>
                {(canVoid || canDelete) && <DropdownMenuSeparator />}
                {canVoid && (
                  <DropdownMenuItem destructive onSelect={() => setVoidOpen(true)}>
                    <MENU_ICONS.void aria-hidden />
                    Void invoice
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                    <MENU_ICONS.delete aria-hidden />
                    Delete draft
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/invoices/${invoice.id}/history`} subjectLabel="this invoice" open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {invoice.status === "void" && invoice.voidReason && (
        <Alert variant="warning">
          <AlertDescription>
            Voided{invoice.voidedAt && <> on {new Date(invoice.voidedAt).toLocaleDateString(locale)}</>}: {invoice.voidReason}
          </AlertDescription>
        </Alert>
      )}

      {/* S-05.7 — "was the email sent?"; nothing shows until Email invoice has been used (emailStatus is null until then). */}
      {invoice.emailStatus === "pending" && (
        <p className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
          <Clock size={14} className="shrink-0" />
          Sending email to {invoice.contactName ?? "the contact"}…
        </p>
      )}
      {invoice.emailStatus === "failed" && <EmailFailedAlert error={invoice.emailError} recordId={invoice.id} />}

      {figures.length > 0 && (
        <div className={cn("grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface", figures.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")} data-testid="invoice-figures">
          {figures}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {invoice.type === "opening" ? (
            <Card className="text-[13px] text-on-surface-muted">Brought in from your old system, so it has no lines. Attach the original below to keep it with the invoice.</Card>
          ) : (
            <DocumentLinesTable doc={invoice} testIdPrefix="invoice" after={afterTotal} />
          )}

          {retentionAmount > 0n && invoice.retention && (
            <p className="text-[12px] text-on-surface-muted" data-testid="retention-note">
              Retention is held in Retention Receivable until you release it from the job. Held on this job so far: {money(BigInt(invoice.retention.heldOnJob))}.
            </p>
          )}

          {(invoice.notes || invoice.termsAndConditions) && (
            <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {invoice.notes && (
                <div>
                  <h3 className="text-[12px] font-semibold text-on-surface-muted">Notes</h3>
                  <RichTextContent html={invoice.notes} />
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <h3 className="text-[12px] font-semibold text-on-surface-muted">Terms &amp; conditions</h3>
                  <RichTextContent html={invoice.termsAndConditions} />
                </div>
              )}
            </Card>
          )}

          <PaymentsSection
            invoice={invoice}
            refreshKey={paymentsRefreshKey}
            onChanged={({ title, description }) => {
              load();
              setPaymentsRefreshKey((key) => key + 1);
              showToast(title, description);
            }}
          />
          <CreditNotesSection invoiceId={invoice.id} refreshKey={creditNotesRefreshKey} canEmail={hasSendCapability} />
          <AttachmentsSection entityType="invoice" entityId={invoice.id} />
        </div>

        <InvoiceActivity
          invoiceId={invoice.id}
          currency={invoice.currency}
          refreshKey={`${invoice.updatedAt}-${invoice.emailStatus}-${invoice.amountPaid}-${invoice.creditedAmount}-${paymentsRefreshKey}`}
          onViewHistory={() => setHistoryOpen(true)}
        />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft invoice?</AlertDialogTitle>
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

      {/* S-05.8 — void requires a reason; the API rejects an empty one, so this is a required field, not optional. */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this invoice?</DialogTitle>
            <DialogDescription>
              Posts a reversing journal entry and marks {invoice.number} as void. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {voidError && (
              <Alert variant="critical">
                <AlertDescription>{voidError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Reason" required>
              {(field) => (
                <Input
                  {...field}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Why is this invoice being voided?"
                />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVoidOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleVoid} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Void invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={missingHsn > 0} onOpenChange={(open) => !open && setMissingHsn(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue without HSN/SAC codes?</AlertDialogTitle>
            <AlertDialogDescription>{missingHsnSacMessage(missingHsn)} Add them on the invoice, or issue it as it is.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={issueAnyway}>Issue anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue this invoice?</AlertDialogTitle>
            <AlertDialogDescription data-testid="confirm-issue">
              {invoice.contactName ?? "The customer"} will owe {money(BigInt(invoice.totalAmount) - retentionAmount)}, due {issueDueLabel}. Issuing gives the invoice its permanent number
              {invoice.type === "advance" ? "" : " and posts it to your books"}. After that it can&apos;t be edited — only voided or credited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <Button onClick={() => void handleIssue(false)} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Issue invoice"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* D-187 — apply the customer's credit as the invoice is issued. */}
      <AlertDialog open={creditOffer > 0n} onOpenChange={(open) => !open && setCreditOffer(0n)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this customer&apos;s credit?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.contactName ?? "This customer"} has {formatMoney(creditOffer, invoice.currency)} of credit from payments and credit notes. Apply it as the invoice is issued, so the invoice — and its UPI QR code, if it has one — asks only for what&apos;s still owed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <Button variant="secondary" onClick={() => void handleIssue(false)}>
              Issue without credit
            </Button>
            <AlertDialogAction onClick={issueWithCredit}>Apply credit and issue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        contactId={invoice.contactId}
        contactName={invoice.contactName}
        presetInvoiceId={invoice.id}
        onRecorded={() => {
          load();
          setPaymentsRefreshKey((key) => key + 1);
          showToast("Payment recorded", "The invoice's balance has been updated.");
        }}
      />

      <CreateCreditNoteDialog
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.number}
        customerName={invoice.contactName ?? null}
        onIssued={(note) => {
          load();
          setCreditNotesRefreshKey((key) => key + 1);
          showToast(...creditNoteIssuedToast(note, invoice.contactName ?? null));
        }}
      />

      <ApplyCustomerCreditDialog
        open={applyCreditOpen}
        onOpenChange={setApplyCreditOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.number}
        contactId={invoice.contactId}
        currency={invoice.currency}
        balanceDue={balanceDue}
        onApplied={(total) => {
          load();
          setPaymentsRefreshKey((key) => key + 1);
          showToast("Credit applied", `${formatMoney(total, invoice.currency)} of credit now counts against ${invoice.number ?? "this invoice"}.`);
        }}
      />

      {sendDialog && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setSendDialog(null)}
          title={sendDialog === "invoice" ? `Email invoice ${invoice.number ?? ""}`.trim() : `Send payment reminder — ${invoice.number ?? ""}`}
          description={`${invoice.contactName ?? "Customer"} · ${formatMoney(balanceDue, invoice.currency)} due`}
          draftPath={`/email-drafts/${sendDialog}/${invoice.id}`}
          sendLabel={sendDialog === "invoice" ? "Send invoice" : "Send reminder"}
          pdfLabel="Attach the invoice PDF"
          onSend={(email) => (sendDialog === "invoice" ? handleSendEmail(email) : handleSendReminder(email))}
        />
      )}
    </div>
  );
}

