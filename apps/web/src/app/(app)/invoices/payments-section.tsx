"use client";

import { useEffect, useState } from "react";
import { Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Spinner } from "@spine/ui";
import type { PaymentAppliedTo } from "@spine/shared";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { UnapplyDialog } from "../payments/payment-detail";
import { calendarDate } from "../quotes/quotes-list-state";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { PAYMENT_METHOD_LABELS, type InvoicePaymentRow } from "./types";

import { SectionLink } from "../../../components/section-link";
import { useT } from "../../../lib/i18n";
/**
 * Every payment allocated against this invoice — `GET /payments?invoiceId=`
 * (`PaymentsService.listForInvoice`, a real join through
 * `payment_allocations`). Each row opens the payment's page (US-PAY-19);
 * its menu moves the payment off this invoice (US-PAY-26), asking first,
 * except on a deposit or void invoice.
 *
 * Shows nothing when the invoice has never received a payment — a bare
 * "no payments yet" line, not a whole empty-state illustration, since this
 * is a subsection of the detail page, not its own page.
 */
export function PaymentsSection({
  invoice,
  refreshKey,
  onChanged,
}: {
  invoice: { id: string; number: string | null; type: string; status: string; totalAmount: string; balanceDue: string };
  refreshKey: number;
  onChanged?: (message: { title: string; description: string }) => void;
}) {
  const t = useT();
  const [payments, setPayments] = useState<InvoicePaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ payment: InvoicePaymentRow; target: PaymentAppliedTo } | null>(null);
  const canApply = useCapability("payments.apply_credit");
  const canMoveOff = canApply && invoice.type !== "advance" && invoice.status !== "void";

  useEffect(() => {
    setPayments(null);
    apiClient
      .get<InvoicePaymentRow[]>(`/payments?invoiceId=${invoice.id}`)
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : t("invoices.paymentsSection.loadFailed")));
  }, [invoice.id, refreshKey]);

  if (error) return null; // non-critical subsection — a failure here shouldn't block the rest of the invoice page

  const today = new Date();
  const locale = orgLocaleTag();

  return (
    <Card className="flex flex-col gap-3" data-testid="invoice-payments">
      <h3 className="text-[14px] font-semibold text-on-surface">{t("invoices.paymentsSection.title")}</h3>
      {!payments ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">{t("invoices.paymentsSection.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.allocationId} className="flex items-center justify-between gap-4 py-2" data-testid="invoice-payment-row">
              <div>
                <SectionLink href={`/payments/${payment.id}`} className="text-[13px] font-medium text-on-surface hover:text-primary hover:underline">
                  {payment.number ?? t("invoices.paymentsSection.payment")}
                </SectionLink>
                <p className="text-[12px] text-on-surface-muted">
                  {calendarDate(payment.date.slice(0, 10), today, locale)} · {PAYMENT_METHOD_LABELS[payment.method]}
                  {payment.reference && <> · {payment.reference}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[13px] tabular-nums text-on-surface">{formatMoney(BigInt(payment.allocatedToThisInvoice), payment.currency)}</span>
                {canMoveOff && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={t("invoices.paymentsSection.actionsFor", { number: payment.number ?? t("invoices.paymentsSection.thisPayment") })} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          setMoving({
                            payment,
                            target: {
                              allocationId: payment.allocationId,
                              invoiceId: invoice.id,
                              invoiceNumber: invoice.number,
                              invoiceTotal: invoice.totalAmount,
                              invoiceBalance: invoice.balanceDue,
                              invoiceType: invoice.type,
                              invoiceStatus: invoice.status,
                              amount: payment.allocatedToThisInvoice,
                              at: payment.allocatedAt,
                            },
                          })
                        }
                      >
                        <MENU_ICONS.moveOff aria-hidden />
                        {t("invoices.paymentsSection.moveOff")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <UnapplyDialog
        target={moving?.target ?? null}
        payment={{ id: moving?.payment.id ?? "", currency: moving?.payment.currency ?? "USD", contactName: moving?.payment.contactName ?? null }}
        onClose={() => setMoving(null)}
        onDone={(a) => {
          const p = moving?.payment;
          setMoving(null);
          onChanged?.({
            title: t("invoices.paymentsSection.movedTitle", { amount: formatMoney(BigInt(a.amount), p?.currency ?? "USD") }),
            description: t("invoices.paymentsSection.movedBody", { number: p?.number ?? t("invoices.paymentsSection.thePayment"), invoice: invoice.number ?? t("invoices.paymentsSection.thisInvoice") }),
          });
        }}
      />
    </Card>
  );
}
