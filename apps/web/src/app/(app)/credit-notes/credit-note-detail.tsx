"use client";

import { placeOfSupplyLabel, SUPPLY_TYPE_LABELS } from "@spine/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Badge,
  Breadcrumb,
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from "@spine/ui";
import { ArrowRightLeft, Banknote, ChevronDown, Download, Mail, MapPin, Receipt, Send, User } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { HistorySection } from "../../../components/history-section";
import { AttachmentsSection } from "../../../components/attachments-section";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { CustomerRefundDialog, RefundsSection, refundToast } from "../../../components/customer-refund-dialog";
import { DocumentLinesTable, type AfterTotalRow } from "../../../components/document-lines-table";
import { useToast } from "../../../components/toast-host";
import { calendarDate } from "../quotes/quotes-list-state";
import type { CreditNote } from "../invoices/types";
import { ApplyCreditNoteDialog } from "./apply-credit-note-dialog";
import { CreditNoteActivity } from "./credit-note-activity";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { CREDIT_NOTE_STATE_LABELS, creditNoteState } from "./credit-notes-list-state";

import { SectionLink } from "../../../components/section-link";
import { useLoadFailure } from "../../../lib/use-load-failure";
import { useT } from "../../../lib/i18n";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATE_BADGE: Record<ReturnType<typeof creditNoteState>, string> = {
  draft: "bg-draft-bg text-draft",
  credit_left: "bg-due-soon-bg text-due-soon",
  credited: "bg-paid-bg text-paid",
};

/**
 * A credit note's page (US-INV-38, US-INV-39, D-219), replacing the drawer.
 * The number is the title, with the customer, the invoice it corrects, the
 * date and the reason. One primary button is the next step — Apply credit
 * while credit is left, else Email credit note if it hasn't been emailed,
 * else Download PDF — with Refund, Email, Download PDF and View history
 * beside it or under More. A strip reads Credited, Off the invoice,
 * Applied, Refunded and Credit left; the lines carry the invoice's tax by
 * name; Activity tells its story. `?action=apply|refund|email` (from a
 * row's menu) opens that dialog.
 */
export function CreditNoteDetail({ creditNoteId }: { creditNoteId: string }) {
  const t = useT();
  const loadFailed = useLoadFailure(creditNoteId);
  const router = useRouter();
  const [note, setNote] = useState<CreditNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const showToast = useToast();
  const canApply = useCapability("payments.apply_credit");
  const canRefund = useCapability("payments.refund");
  const canSend = useCapability("invoices.send");
  const searchParams = useSearchParams();
  const action = useRef(searchParams.get("action"));

  const load = useCallback(() => {
    apiClient
      .get<CreditNote>(`/credit-notes/${creditNoteId}`)
      .then(setNote)
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : t("creditNotes.detail.loadFailed")));
  }, [creditNoteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const left = note ? BigInt(note.creditRemainingAmount ?? "0") : 0n;
  const issued = note?.status === "issued";

  // A row's menu opens the page with ?action= — once, then the address is cleaned.
  useEffect(() => {
    const next = action.current;
    if (!note || !next) return;
    action.current = null;
    router.replace(`/credit-notes/${note.id}`, { scroll: false });
    if (next === "apply" && issued && left > 0n) setApplyOpen(true);
    else if (next === "refund" && issued && left > 0n) setRefundOpen(true);
    else if (next === "email" && issued) setEmailOpen(true);
    // Runs once, when the credit note first loads (action.current is cleared).
  }, [note]);

  if (error && !note) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!note) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const locale = orgLocaleTag();
  const today = new Date();
  const money = (v: string | bigint) => formatMoney(BigInt(v), note.currency);
  const state = creditNoteState({ status: note.status, creditRemainingAmount: note.creditRemainingAmount ?? "0" });
  const off = BigInt(note.offInvoiceAmount ?? "0");
  const applied = BigInt(note.appliedAmount ?? "0");
  const refunded = BigInt(note.refundedAmount ?? "0");
  const pdfUrl = `${API_URL}/credit-notes/${note.id}/pdf`;
  const title = note.number ?? t("creditNotes.detail.draftCreditNote");

  type Action = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string };
  const pdf: Action = { key: "pdf", label: issued ? t("creditNotes.detail.downloadPdf") : t("creditNotes.detail.previewPdf"), icon: <Download size={14} aria-hidden />, href: pdfUrl };
  const apply: Action = { key: "apply", label: t("creditNotes.detail.applyCredit"), icon: <ArrowRightLeft size={14} aria-hidden />, onClick: () => setApplyOpen(true) };
  const email: Action = { key: "email", label: t("creditNotes.detail.emailCreditNote"), icon: <Mail size={14} aria-hidden />, onClick: () => setEmailOpen(true) };
  const refund: Action = { key: "refund", label: t("creditNotes.detail.refund"), icon: <Banknote size={14} aria-hidden />, onClick: () => setRefundOpen(true) };
  const canApplyNow = issued && left > 0n && canApply;
  const canRefundNow = issued && left > 0n && canRefund;
  const canEmailNow = issued && canSend;
  let primary: Action;
  if (canApplyNow) primary = apply;
  else if (canEmailNow && !note.lastEmailedAt) primary = email;
  else primary = pdf;
  const secondary = [pdf, ...(canRefundNow ? [refund] : [])].filter((a) => a.key !== primary.key);
  const inMore = [...(canEmailNow && primary.key !== "email" ? [email] : [])];

  const render = (a: Action, variant: "primary" | "secondary") =>
    a.href ? (
      <Button key={a.key} variant={variant} asChild>
        <a href={a.href} target="_blank" rel="noreferrer">
          {a.icon}
          {a.label}
        </a>
      </Button>
    ) : (
      <Button key={a.key} variant={variant} onClick={a.onClick}>
        {a.icon}
        {a.label}
      </Button>
    );

  const secondaryButtons = secondary.map((a) => render(a, "secondary"));
  const primaryButton = render(primary, "primary");

  const taxNote = note.taxLines?.length
    ? t("creditNotes.detail.taxNoteNamed", { label: note.taxLines.map((taxLine) => taxLine.label.replace(/\s*\(.*\)$/, "").replace(/\s*\d+(\.\d+)?%$/, "")).join(" + "), amount: money(note.taxAmount) })
    : BigInt(note.taxAmount) > 0n
      ? t("creditNotes.detail.taxNoteTax", { amount: money(note.taxAmount) })
      : t("creditNotes.detail.noTax");
  const figure = (label: string, value: string, sub: React.ReactNode, testId: string, tone?: string) => (
    <div key={testId} className="flex min-w-0 flex-col gap-1 border-border p-4 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );
  const appliedTo = note.allocations ?? [];
  const figures = issued
    ? [
        figure(t("creditNotes.detail.figCredited"), money(note.totalAmount), taxNote, "fig-credited"),
        off > 0n ? figure(t("creditNotes.detail.figOff", { number: note.invoiceNumber ?? t("creditNotes.detail.theInvoice") }), money(off), t("creditNotes.detail.stillOwed"), "fig-off") : null,
        applied > 0n ? figure(t("creditNotes.detail.figApplied"), money(applied), appliedTo.length === 1 ? t("creditNotes.detail.toInvoice", { number: appliedTo[0]!.invoiceNumber }) : t("creditNotes.detail.toInvoices", { n: appliedTo.length }), "fig-applied") : null,
        refunded > 0n ? figure(t("creditNotes.detail.figRefunded"), money(refunded), t("creditNotes.detail.paidBack"), "fig-refunded") : null,
        figure(t("creditNotes.detail.figLeft"), money(left), left > 0n ? t("creditNotes.detail.toApplyOrRefund") : t("creditNotes.detail.allUsed"), "fig-left", left > 0n ? "text-due-soon" : undefined),
      ].filter(Boolean)
    : [];

  const after: AfterTotalRow[] = issued
    ? [
        ...(off > 0n ? [{ label: t("creditNotes.detail.figOff", { number: note.invoiceNumber ?? t("creditNotes.detail.theInvoice") }), amount: off, subtract: true }] : []),
        ...appliedTo.map((a) => ({ label: t("creditNotes.detail.appliedTo", { number: a.invoiceNumber ?? t("creditNotes.detail.anInvoice") }), amount: BigInt(a.amount), subtract: true, tone: "paid" as const })),
        ...(refunded > 0n ? [{ label: t("creditNotes.detail.refunded"), amount: refunded, subtract: true }] : []),
        { label: t("creditNotes.detail.creditLeft"), amount: left, tone: "balance" as const },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t("creditNotes.detail.breadcrumbBilling") }, { label: t("creditNotes.detail.breadcrumbCreditNotes"), href: "/credit-notes" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
              <Badge className={STATE_BADGE[state]} data-testid="credit-note-state">
                {CREDIT_NOTE_STATE_LABELS[state]}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="credit-note-meta">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                <SectionLink href={`/contacts/${note.contactId}`} className="font-medium text-primary hover:underline">
                  {note.contactName ?? t("creditNotes.detail.unknownContact")}
                </SectionLink>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Receipt size={14} aria-hidden />
                {t("creditNotes.detail.against")}{" "}
                <SectionLink href={`/invoices/${note.invoiceId}`} className="font-medium text-primary hover:underline">
                  {note.invoiceNumber ?? t("creditNotes.detail.theInvoice")}
                </SectionLink>
              </span>
              {note.issuedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} aria-hidden />
                  {t("creditNotes.detail.issuedOn", { date: calendarDate(note.issuedAt.slice(0, 10), today, locale) })}
                </span>
              )}
              {note.placeOfSupply && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  {placeOfSupplyLabel(note.placeOfSupply)}
                  {note.supplyType ? ` (${SUPPLY_TYPE_LABELS[note.supplyType].toLowerCase()})` : ""}
                </span>
              )}
            </p>
            {note.reason && (
              <p className="text-[13.5px] text-on-surface" data-testid="credit-note-reason">
                {note.reason}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="credit-note-actions">
            {secondaryButtons}
            {primaryButton}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  {t("creditNotes.detail.more")} <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {inMore.map((a) => (
                  <DropdownMenuItem key={a.key} onSelect={a.onClick}>
                    {a.icon}
                    {a.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  {t("creditNotes.detail.viewHistory")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/credit-notes/${note.id}/history`} subjectLabel={t("creditNotes.detail.historySubject")} open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {figures.length > 0 && (
        <div className={cn("grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface", figures.length >= 4 ? "md:grid-cols-4" : figures.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")} data-testid="credit-note-figures">
          {figures}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <DocumentLinesTable
            doc={{
              currency: note.currency,
              placeOfSupply: note.placeOfSupply ?? null,
              subtotalAmount: note.subtotalAmount,
              discountAmount: "0",
              taxAmount: note.taxAmount,
              totalAmount: note.totalAmount,
              taxLines: note.taxLines,
              lines: note.lines.map((l) => ({ ...l, discountPercentage: 0, supplyClass: l.supplyClass ?? null })),
            }}
            testIdPrefix="credit-note"
            after={after}
          />
          {/* Shown only once the refunds section has something to list. */}
          <Card className="hidden p-0 has-[[data-testid=refunds]]:block">
            <div className="px-4 py-3">
              <RefundsSection contactId={note.contactId} sourceId={note.id} refreshKey={refreshKey} canRefund={canRefund} onChanged={() => setRefreshKey((k) => k + 1)} />
            </div>
          </Card>
          <AttachmentsSection entityType="credit_note" entityId={note.id} />
        </div>
        <CreditNoteActivity creditNoteId={note.id} currency={note.currency} refreshKey={`${note.updatedAt}-${refreshKey}`} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      <ApplyCreditNoteDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        creditNoteId={note.id}
        creditNoteNumber={note.number}
        contactId={note.contactId}
        contactName={note.contactName}
        currency={note.currency}
        creditLeft={left}
        onApplied={(total, count) => {
          setRefreshKey((k) => k + 1);
          showToast(t("creditNotes.detail.appliedTitle"), t("creditNotes.detail.appliedBody", { amount: money(total), count }));
        }}
      />
      <CustomerRefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        contactId={note.contactId}
        contactName={note.contactName ?? t("creditNotes.detail.theCustomer")}
        currency={note.currency}
        sourceId={note.id}
        onRefunded={(r) => {
          setRefreshKey((k) => k + 1);
          const { title: toastTitle, description } = refundToast(r);
          showToast(toastTitle, description);
        }}
      />
      {emailOpen && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setEmailOpen(false)}
          title={t("creditNotes.detail.emailTitle", { number: note.number ?? "" }).trim()}
          description={money(note.totalAmount)}
          draftPath={`/email-drafts/credit_note/${note.id}`}
          sendLabel={t("creditNotes.detail.sendLabel")}
          pdfLabel={t("creditNotes.detail.pdfLabel")}
          onSend={async (body) => {
            const result = await apiClient.post<{ sentTo: string }>(`/credit-notes/${note.id}/send-email`, body);
            setRefreshKey((k) => k + 1);
            showToast(t("creditNotes.detail.emailedTitle"), t("creditNotes.detail.emailedBody", { number: note.number ?? t("creditNotes.detail.theCreditNote"), to: result.sentTo }));
          }}
        />
      )}
    </div>
  );
}
