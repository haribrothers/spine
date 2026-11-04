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
  useConfirm,
} from "@spine/ui";
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
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PaymentState = "applied" | "credit" | "refunded";
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = { applied: "Fully applied", credit: "Credit left", refunded: "Refunded" };
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
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : "Couldn't load this payment."));
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const left = payment ? BigInt(payment.unallocatedAmount) : 0n;
  const canDelete = Boolean(payment && payment.allocatedAmount === "0" && BigInt(payment.refundedAmount ?? "0") === 0n && canDeleteRight);

  async function deletePayment() {
    if (!payment) return;
    const ok = await confirm({
      title: "Delete this payment?",
      description: `This posts a reversing journal entry and permanently removes ${payment.number ?? "this payment"}. This can't be undone.`,
      confirmLabel: "Delete payment",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.delete(`/payments/${payment.id}`);
      showToast("Payment deleted", `${payment.number ?? "The payment"} was deleted and its journal entry reversed.`);
      router.push("/payments");
    } catch (err) {
      setActionError({ title: "Couldn't delete the payment.", message: err instanceof Error ? err.message : "Try again." });
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
  const title = payment.number ?? "Payment";
  const method = PAYMENT_METHOD_LABELS[payment.method];
  const date = calendarDate(payment.date.slice(0, 10), today, locale);
  const appliedTo = payment.appliedTo ?? [];

  type Action = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string };
  const pdf: Action = { key: "pdf", label: "Download PDF", icon: <Download size={14} aria-hidden />, href: `${API_URL}/payments/${payment.id}/pdf` };
  const apply: Action = { key: "apply", label: "Apply credit", icon: <ArrowRightLeft size={14} aria-hidden />, onClick: () => setApplyOpen(true) };
  const email: Action = { key: "email", label: "Email receipt", icon: <Mail size={14} aria-hidden />, onClick: () => setEmailOpen(true) };
  const refund: Action = { key: "refund", label: "Refund", icon: <Banknote size={14} aria-hidden />, onClick: () => setRefundOpen(true) };
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

  const figure = (label: string, value: string, sub: React.ReactNode, testId: string, tone?: string) => (
    <div key={testId} className="flex min-w-0 flex-col gap-1 border-border p-4 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );
  const figures = [
    figure("Received", money(payment.amount), `${method} · ${date}`, "fig-received"),
    figure("Applied", money(applied), appliedTo.length === 0 ? "Not applied yet" : appliedTo.length === 1 ? `To ${appliedTo[0]!.invoiceNumber ?? "1 invoice"}` : `To ${appliedTo.length} invoices`, "fig-applied"),
    refunded > 0n ? figure("Refunded", money(refunded), "Paid back to the customer", "fig-refunded") : null,
    figure("Credit left", money(left), left > 0n ? "To apply or refund" : "Nothing left to apply", "fig-left", left > 0n ? "text-due-soon" : undefined),
  ].filter(Boolean);

  const canMoveOff = (a: PaymentAppliedTo) => canApply && a.invoiceType !== "advance" && a.invoiceStatus !== "void";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Payments", href: "/payments" }, { label: title }]} />
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
                  {payment.contactName ?? "Unknown contact"}
                </SectionLink>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {method} · {date}
              </span>
              {payment.moneyAccount && (
                <span className="inline-flex items-center gap-1.5">
                  <Landmark size={14} aria-hidden />
                  Paid into {payment.moneyAccount.name}
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
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="payment-actions">
            {secondary.map((a) => render(a, "secondary"))}
            {render(primary, "primary")}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  More <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canSend && primary.key !== "email" && (
                  <DropdownMenuItem onSelect={() => setEmailOpen(true)}>
                    <MENU_ICONS.email aria-hidden />
                    Email receipt
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  View history
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => void deletePayment()}>
                      <MENU_ICONS.delete aria-hidden />
                      Delete payment
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/payments/${payment.id}/history`} subjectLabel="this payment" open={historyOpen} onOpenChange={setHistoryOpen} />
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
            <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Applied to</h3>
            {appliedTo.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-on-surface-muted">Not applied to any invoice — it&apos;s all credit for {payment.contactName ?? "the customer"}, to apply or refund.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-surface-sunken text-[12px] text-on-surface-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Invoice</th>
                      <th className="px-4 py-2 text-right font-medium">Invoice total</th>
                      <th className="px-4 py-2 text-right font-medium">From this payment</th>
                      <th className="px-4 py-2 text-right font-medium">Still owes</th>
                      <th className="px-4 py-2 text-right font-medium">Applied</th>
                      <th className="w-10 px-2 py-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedTo.map((a) => (
                      <tr key={a.allocationId} className="border-t border-border" data-testid="applied-to-row">
                        <td className="px-4 py-2.5">
                          <SectionLink href={`/invoices/${a.invoiceId}`} className="font-medium text-primary hover:underline">
                            {a.invoiceNumber ?? "Invoice"}
                          </SectionLink>
                          {a.invoiceType === "advance" && <span className="ml-2 text-[12px] text-on-surface-muted">Deposit</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(a.invoiceTotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(a.amount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{BigInt(a.invoiceBalance) > 0n ? money(a.invoiceBalance) : <span className="font-medium text-paid">Paid</span>}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">{calendarDate(a.at.slice(0, 10), today, locale)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`Actions for ${a.invoiceNumber ?? "this invoice"}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => router.push(`/invoices/${a.invoiceId}`)}>
                                <MENU_ICONS.open aria-hidden />
                                Open {a.invoiceNumber ?? "invoice"}
                              </DropdownMenuItem>
                              {canMoveOff(a) && (
                                <DropdownMenuItem onSelect={() => setUnapplying(a)}>
                                  <MENU_ICONS.moveOff aria-hidden />
                                  Move off {a.invoiceNumber ?? "this invoice"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {payment.notes && (
            <Card className="flex flex-col gap-1">
              <h3 className="text-[14px] font-semibold text-on-surface">Notes</h3>
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
          showToast("Credit applied", `Credit from ${payment.number ?? "this payment"} now counts against the invoice.`);
        }}
      />
      <CustomerRefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        contactId={payment.contactId}
        contactName={payment.contactName ?? "the customer"}
        currency={payment.currency}
        sourceId={payment.id}
        onRefunded={(r) => {
          setRefreshKey((k) => k + 1);
          const { title: t, description } = refundToast(r);
          showToast(t, description);
        }}
      />
      {emailOpen && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setEmailOpen(false)}
          title={`Email receipt ${payment.number ?? ""}`.trim()}
          description={payment.contactName ?? undefined}
          draftPath={`/email-drafts/receipt/${payment.id}`}
          sendLabel="Send receipt"
          pdfLabel="Attach the receipt PDF"
          onSend={async (body: EmailOverride) => {
            await apiClient.post(`/payments/${payment.id}/send-receipt`, body);
            setRefreshKey((k) => k + 1);
            showToast("Receipt sent", `The receipt for ${payment.number ?? "this payment"} was emailed to ${body.to ?? payment.contactName ?? "the customer"}.`);
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
          showToast(`${money(a.amount)} is now credit`, `${a.invoiceNumber ?? "The invoice"} owes it again; apply it to the right invoice or refund it.`);
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
  const label = target.invoiceNumber ?? "the invoice";

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/payments/${payment.id}/allocations/${target.allocationId}/unapply`, { reason: reason.trim() || null });
      onDone(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move the payment. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            Move {money(target.amount)} off {label}?
          </DialogTitle>
          <DialogDescription>
            {label} will owe {money(owesAfter)} again, and {money(target.amount)} becomes credit for {payment.contactName ?? "the customer"} to apply to the right invoice or refund. The receipt already sent isn&apos;t changed.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Reason" helperText="Optional, kept in the history.">
            {(field) => <Textarea {...field} rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Belongs on another invoice" />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Go back
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : (
              <>
                <Undo2 size={14} aria-hidden />
                Move off invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
