"use client";

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
  Spinner,
  Textarea,
  useConfirm, ScrollX } from "@spine/ui";
import type { EmailOverride, PaymentAppliedTo } from "@spine/shared";
import { ArrowRightLeft, Banknote, CalendarDays, ChevronDown, Download, Hash, Landmark, Mail, MoreHorizontal, Undo2, User } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { HistorySection } from "../../../components/history-section";
import { AttachmentsSection } from "../../../components/attachments-section";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { CustomerRefundDialog, RefundsSection, refundToast } from "../../../components/customer-refund-dialog";
import { useToast } from "../../../components/toast-host";
import { calendarDate } from "../quotes/quotes-list-state";
import { ApplyCreditDialog } from "./apply-credit-dialog";
import { PaymentActivity } from "./payment-activity";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { PAYMENT_METHOD_LABELS, type PaymentDetailData } from "./types";
import { ActionError } from "../../../components/action-error";

import { SectionLink } from "../../../components/section-link";
import { useLoadFailure } from "../../../lib/use-load-failure";
import { t, useT } from "../../../lib/i18n";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PaymentState = "applied" | "credit" | "refunded";
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = { applied: t("payments.state.applied"), credit: t("payments.state.credit"), refunded: t("payments.state.refunded") };
const STATE_BADGE: Record<PaymentState, string> = { applied: "bg-paid-bg text-paid", credit: "bg-due-soon-bg text-due-soon", refunded: "bg-draft-bg text-draft" };

/** Where a payment's money stands: credit still left, or none — all applied, or (some) paid back. */
export function paymentState(p: { unallocatedAmount: string; refundedAmount?: string }): PaymentState {
  if (BigInt(p.unallocatedAmount) > 0n) return "credit";
  return BigInt(p.refundedAmount ?? "0") > 0n ? "refunded" : "applied";
}

/**
 * A payment's page (US-PAY-19, US-PAY-20, US-PAY-26, D-221), replacing the
 * drawer. The receipt number is the title with where the money stands, the
 * customer, the date and method, the account and the reference. One
 * primary button is the next step — Apply credit while credit is left,
 * else Email receipt, else Download PDF — with Refund, Download PDF, Delete
 * and View history beside it or under More. A strip reads Received,
 * Applied, Refunded and Credit left; "Applied to" lists each invoice with
 * what it still owes, and its menu moves the payment off one (asking first,
 * with a reason). `?action=apply|refund|email|delete` (from a row's menu)
 * opens that dialog.
 */
export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const t = useT();
  const loadFailed = useLoadFailure(paymentId);
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [unapplying, setUnapplying] = useState<PaymentAppliedTo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canApply = useCapability("payments.apply_credit");
  const canRefund = useCapability("payments.refund");
  const canSend = useCapability("payments.send_receipt");
  const canDeleteRight = useCanEditOwnership(payment?.createdByUserId ?? null, { own: "payments.delete_own", others: "payments.delete_others" });
  const searchParams = useSearchParams();
  const action = useRef(searchParams.get("action"));

  const load = useCallback(() => {
    apiClient
      .get<PaymentDetailData>(`/payments/${paymentId}`)
      .then(setPayment)
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : t("payments.detail.loadFailed")));
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const left = payment ? BigInt(payment.unallocatedAmount) : 0n;
  const canDelete = Boolean(payment && payment.allocatedAmount === "0" && BigInt(payment.refundedAmount ?? "0") === 0n && canDeleteRight);

  async function deletePayment() {
    if (!payment) return;
    const ok = await confirm({
      title: t("payments.detail.deleteTitle"),
      description: t("payments.detail.deleteDescription", { number: payment.number ?? t("payments.detail.thisPayment") }),
      confirmLabel: t("payments.detail.deletePayment"),
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.delete(`/payments/${payment.id}`);
      showToast(t("payments.detail.deletedTitle"), t("payments.detail.deletedBody", { number: payment.number ?? t("payments.detail.thePayment") }));
      router.push("/payments");
    } catch (err) {
      setActionError({ title: t("payments.detail.deleteFailed"), message: err instanceof Error ? err.message : t("payments.detail.tryAgain") });
    }
  }

  // A row's menu opens the page with ?action= — once, then the address is cleaned.
  useEffect(() => {
    const next = action.current;
    if (!payment || !next) return;
    action.current = null;
    router.replace(`/payments/${payment.id}`, { scroll: false });
    if (next === "apply" && left > 0n) setApplyOpen(true);
    else if (next === "refund" && left > 0n) setRefundOpen(true);
    else if (next === "email") setEmailOpen(true);
    else if (next === "delete" && canDelete) void deletePayment();
    // Runs once, when the payment first loads (action.current is cleared).
  }, [payment]);

  if (error && !payment) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!payment) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const locale = orgLocaleTag();
  const today = new Date();
  const money = (v: string | bigint) => formatMoney(BigInt(v), payment.currency);
  const state = paymentState(payment);
  const applied = BigInt(payment.allocatedAmount);
  const refunded = BigInt(payment.refundedAmount ?? "0");
  const title = payment.number ?? t("payments.detail.payment");
  const method = PAYMENT_METHOD_LABELS[payment.method];
  const date = calendarDate(payment.date.slice(0, 10), today, locale);
  const appliedTo = payment.appliedTo ?? [];

  type Action = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string };
  const pdf: Action = { key: "pdf", label: t("payments.detail.downloadPdf"), icon: <Download size={14} aria-hidden />, href: `${API_URL}/payments/${payment.id}/pdf` };
  const apply: Action = { key: "apply", label: t("payments.detail.applyCredit"), icon: <ArrowRightLeft size={14} aria-hidden />, onClick: () => setApplyOpen(true) };
  const email: Action = { key: "email", label: t("payments.detail.emailReceipt"), icon: <Mail size={14} aria-hidden />, onClick: () => setEmailOpen(true) };
  const refund: Action = { key: "refund", label: t("payments.detail.refund"), icon: <Banknote size={14} aria-hidden />, onClick: () => setRefundOpen(true) };
  const primary = left > 0n && canApply ? apply : canSend ? email : pdf;
  const secondary = [pdf, ...(left > 0n && canRefund ? [refund] : [])].filter((a) => a.key !== primary.key);

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

  const figure = (label: string, value: string, sub: React.ReactNode, testId: string, tone?: string) => (
    <div key={testId} className="flex min-w-0 flex-col gap-1 border-border p-4 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );
  const figures = [
    figure(t("payments.detail.figReceived"), money(payment.amount), `${method} · ${date}`, "fig-received"),
    figure(
      t("payments.detail.figApplied"),
      money(applied),
      appliedTo.length === 0 ? t("payments.detail.notAppliedYet") : appliedTo.length === 1 ? t("payments.detail.toInvoice", { number: appliedTo[0]!.invoiceNumber ?? t("payments.detail.oneInvoice") }) : t("payments.detail.toInvoices", { n: appliedTo.length }),
      "fig-applied",
    ),
    refunded > 0n ? figure(t("payments.detail.figRefunded"), money(refunded), t("payments.detail.paidBack"), "fig-refunded") : null,
    figure(t("payments.detail.figLeft"), money(left), left > 0n ? t("payments.detail.toApplyOrRefund") : t("payments.detail.nothingLeft"), "fig-left", left > 0n ? "text-due-soon" : undefined),
  ].filter(Boolean);

  const canMoveOff = (a: PaymentAppliedTo) => canApply && a.invoiceType !== "advance" && a.invoiceStatus !== "void";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t("payments.detail.breadcrumbBilling") }, { label: t("payments.detail.breadcrumbPayments"), href: "/payments" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
              <Badge className={STATE_BADGE[state]} data-testid="payment-state">
                {PAYMENT_STATE_LABELS[state]}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="payment-meta">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                <SectionLink href={`/contacts/${payment.contactId}`} className="font-medium text-primary hover:underline">
                  {payment.contactName ?? t("payments.detail.unknownContact")}
                </SectionLink>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {method} · {date}
              </span>
              {payment.moneyAccount && (
                <span className="inline-flex items-center gap-1.5">
                  <Landmark size={14} aria-hidden />
                  {t("payments.detail.paidInto", { account: payment.moneyAccount.name })}
                </span>
              )}
              {payment.reference && (
                <span className="inline-flex items-center gap-1.5">
                  <Hash size={14} aria-hidden />
                  {payment.reference}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:w-full max-md:shrink" data-testid="payment-actions">
            {secondaryButtons}
            {primaryButton}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  {t("payments.detail.more")} <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canSend && primary.key !== "email" && (
                  <DropdownMenuItem onSelect={() => setEmailOpen(true)}>
                    <MENU_ICONS.email aria-hidden />
                    {t("payments.detail.emailReceipt")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  {t("payments.detail.viewHistory")}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => void deletePayment()}>
                      <MENU_ICONS.delete aria-hidden />
                      {t("payments.detail.deletePayment")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/payments/${payment.id}/history`} subjectLabel={t("payments.detail.historySubject")} open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      <div className={cn("grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface", figures.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")} data-testid="payment-figures">
        {figures}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-0" data-testid="payment-applied-to">
            <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">{t("payments.detail.appliedTo")}</h3>
            {appliedTo.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-on-surface-muted">{t("payments.detail.notAppliedAny", { name: payment.contactName ?? t("payments.detail.theCustomer") })}</p>
            ) : (
              <ScrollX label={t("ui.scrollX.label")}>
                <table className="w-full text-[13.5px]">
                  <thead className="bg-surface-sunken text-[12px] text-on-surface-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">{t("payments.detail.colInvoice")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("payments.detail.colInvoiceTotal")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("payments.detail.colFromPayment")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("payments.detail.colStillOwes")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("payments.detail.colApplied")}</th>
                      <th className="w-10 px-2 py-2">
                        <span className="sr-only">{t("payments.detail.colActions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedTo.map((a) => (
                      <tr key={a.allocationId} className="border-t border-border" data-testid="applied-to-row">
                        <td className="px-4 py-2.5">
                          <SectionLink href={`/invoices/${a.invoiceId}`} className="font-medium text-primary hover:underline">
                            {a.invoiceNumber ?? t("payments.detail.invoice")}
                          </SectionLink>
                          {a.invoiceType === "advance" && <span className="ml-2 text-[12px] text-on-surface-muted">{t("payments.detail.deposit")}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(a.invoiceTotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(a.amount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{BigInt(a.invoiceBalance) > 0n ? money(a.invoiceBalance) : <span className="font-medium text-paid">{t("payments.detail.paid")}</span>}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">{calendarDate(a.at.slice(0, 10), today, locale)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={t("payments.detail.actionsFor", { number: a.invoiceNumber ?? t("payments.detail.thisInvoice") })} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => router.push(`/invoices/${a.invoiceId}`)}>
                                <MENU_ICONS.open aria-hidden />
                                {t("payments.detail.openInvoice", { number: a.invoiceNumber ?? t("payments.detail.invoiceLower") })}
                              </DropdownMenuItem>
                              {canMoveOff(a) && (
                                <DropdownMenuItem onSelect={() => setUnapplying(a)}>
                                  <MENU_ICONS.moveOff aria-hidden />
                                  {t("payments.detail.moveOff", { number: a.invoiceNumber ?? t("payments.detail.thisInvoice") })}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            )}
          </Card>
          {payment.notes && (
            <Card className="flex flex-col gap-1">
              <h3 className="text-[14px] font-semibold text-on-surface">{t("payments.detail.notes")}</h3>
              <p className="text-[13.5px] text-on-surface">{payment.notes}</p>
            </Card>
          )}
          {/* Shown only once the refunds section has something to list. */}
          <Card className="hidden p-0 has-[[data-testid=refunds]]:block">
            <div className="px-4 py-3">
              <RefundsSection contactId={payment.contactId} sourceId={payment.id} refreshKey={refreshKey} canRefund={canRefund} onChanged={() => setRefreshKey((k) => k + 1)} />
            </div>
          </Card>
          <AttachmentsSection entityType="payment" entityId={payment.id} />
        </div>
        <PaymentActivity paymentId={payment.id} currency={payment.currency} refreshKey={`${payment.updatedAt}-${refreshKey}`} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      <ApplyCreditDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        payment={payment}
        onApplied={() => {
          setRefreshKey((k) => k + 1);
          showToast(t("payments.detail.creditAppliedTitle"), t("payments.detail.creditAppliedBody", { number: payment.number ?? t("payments.detail.thisPayment") }));
        }}
      />
      <CustomerRefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        contactId={payment.contactId}
        contactName={payment.contactName ?? t("payments.detail.theCustomer")}
        currency={payment.currency}
        sourceId={payment.id}
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
          title={t("payments.detail.emailTitle", { number: payment.number ?? "" }).trim()}
          description={payment.contactName ?? undefined}
          draftPath={`/email-drafts/receipt/${payment.id}`}
          sendLabel={t("payments.detail.sendReceipt")}
          pdfLabel={t("payments.detail.attachPdf")}
          onSend={async (body: EmailOverride) => {
            await apiClient.post(`/payments/${payment.id}/send-receipt`, body);
            setRefreshKey((k) => k + 1);
            showToast(t("payments.detail.receiptSentTitle"), t("payments.detail.receiptSentBody", { number: payment.number ?? t("payments.detail.thisPayment"), to: body.to ?? payment.contactName ?? t("payments.detail.theCustomer") }));
          }}
        />
      )}
      <UnapplyDialog
        target={unapplying}
        payment={payment}
        onClose={() => setUnapplying(null)}
        onDone={(a) => {
          setUnapplying(null);
          setRefreshKey((k) => k + 1);
          showToast(t("payments.detail.nowCreditTitle", { amount: money(a.amount) }), t("payments.detail.nowCreditBody", { number: a.invoiceNumber ?? t("payments.detail.theInvoiceCap") }));
        }}
      />
      {confirmDialog}
    </div>
  );
}

/**
 * US-PAY-26 (D-218, D-221) — "Move ₹42,000.00 off INV-0037?": says what the
 * invoice will owe again and that the money becomes the customer's credit,
 * with an optional reason kept in the history.
 */
export function UnapplyDialog({
  target,
  payment,
  onClose,
  onDone,
}: {
  target: PaymentAppliedTo | null;
  payment: { id: string; currency: string; contactName: string | null };
  onClose: () => void;
  onDone: (a: PaymentAppliedTo) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setReason("");
      setError(null);
    }
  }, [target]);

  if (!target) return null;
  const money = (v: string | bigint) => formatMoney(BigInt(v), payment.currency);
  const owesAfter = BigInt(target.invoiceBalance) + BigInt(target.amount);
  const label = target.invoiceNumber ?? t("payments.unapply.theInvoice");

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/payments/${payment.id}/allocations/${target.allocationId}/unapply`, { reason: reason.trim() || null });
      onDone(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.unapply.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {t("payments.unapply.title", { amount: money(target.amount), label })}
          </DialogTitle>
          <DialogDescription>
            {t("payments.unapply.description", { label, owes: money(owesAfter), amount: money(target.amount), name: payment.contactName ?? t("payments.unapply.theCustomer") })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("payments.unapply.reason")} helperText={t("payments.unapply.reasonHelp")}>
            {(field) => <Textarea {...field} rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t("payments.unapply.reasonPlaceholder")} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("payments.unapply.goBack")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : (
              <>
                <Undo2 size={14} aria-hidden />
                {t("payments.unapply.moveOff")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
