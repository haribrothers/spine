"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Checkbox, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, MoneyInput, Spinner, cn } from "@spine/ui";
import { ArrowRightLeft } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { useT } from "../../../lib/i18n";
import { lateLabel } from "../vendor-bills/vendor-bill-state";
import type { VendorBill } from "../vendor-bills/types";
import { fillBills } from "./vendor-credit-state";
import type { VendorCredit } from "./types";

/**
 * US-PUR-25/US-PUR-40 (D-226) — `ApplyVendorCreditDialog`: the vendor's
 * open bills — the one the credit was raised against first, marked so, then
 * oldest first — each with its date, due date with how late and balance,
 * filled in that order from what's left. It reads what's being applied and
 * what's left as the amounts change. Nothing posts (P24a); the bills'
 * balances and the credit's drop.
 */
export function ApplyVendorCreditDialog({
  open,
  onOpenChange,
  credit,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: VendorCredit;
  onApplied: (total: bigint, bills: number) => void;
}) {
  const t = useT();
  const [bills, setBills] = useState<VendorBill[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, bigint>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = BigInt(credit.balanceAmount);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBills(null);
    apiClient
      .get<VendorBill[]>(`/vendor-bills?picker=1&contactId=${credit.contactId}&status=recorded`)
      .then((rows) => {
        const { ordered, amounts: prefill } = fillBills(
          rows.filter((b) => b.currency === credit.currency),
          balance,
          credit.billId,
        );
        setBills(ordered);
        setAmounts(prefill);
      })
      .catch((err) => {
        setBills([]);
        setError(err instanceof Error ? err.message : t("vendorCredits.applyDialog.loadFailed"));
      });
  }, [open, credit.contactId, credit.currency, credit.billId, balance]);

  const total = useMemo(() => Object.values(amounts).reduce((sum, a) => sum + a, 0n), [amounts]);
  const left = balance - total;
  const money = (v: bigint) => formatMoney(v, credit.currency);
  const today = new Date();
  const locale = orgLocaleTag();

  function toggle(bill: VendorBill, on: boolean) {
    const due = BigInt(bill.balanceDue ?? "0");
    const others = total - (amounts[bill.id] ?? 0n);
    const room = balance - others;
    setAmounts((prev) => ({ ...prev, [bill.id]: on ? (room < due ? (room > 0n ? room : 0n) : due) : 0n }));
  }

  async function handleSave() {
    setError(null);
    for (const b of bills ?? []) {
      const due = BigInt(b.balanceDue ?? "0");
      if ((amounts[b.id] ?? 0n) > due) {
        setError(t("vendorCredits.applyDialog.upTo", { amount: money(due), number: b.billNumber }));
        return;
      }
    }
    if (total > balance) {
      setError(t("vendorCredits.applyDialog.creditLeft", { amount: money(balance) }));
      return;
    }
    const allocations = (bills ?? []).filter((b) => (amounts[b.id] ?? 0n) > 0n).map((b) => ({ billId: b.id, amount: amounts[b.id]!.toString() }));
    if (!allocations.length) {
      setError(t("vendorCredits.applyDialog.enterAmount"));
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/vendor-credits/${credit.id}/apply`, { allocations });
      onOpenChange(false);
      onApplied(total, allocations.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorCredits.applyDialog.applyFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("vendorCredits.applyDialog.title", { number: credit.number })}</DialogTitle>
          <DialogDescription>{t("vendorCredits.applyDialog.description", { amount: money(balance) })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!bills ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : bills.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{t("vendorCredits.applyDialog.noOpenBills", { vendor: credit.contactName ?? t("vendorCredits.applyDialog.thisVendor") })}</p>
          ) : (
            <>
              <p className="text-[12.5px] font-medium text-on-surface">
                {credit.billId && bills[0]?.id === credit.billId
                  ? t("vendorCredits.applyDialog.openBillsAgainstFirst", { vendor: credit.contactName ?? t("vendorCredits.applyDialog.theVendor") })
                  : t("vendorCredits.applyDialog.openBillsOldestFirst", { vendor: credit.contactName ?? t("vendorCredits.applyDialog.theVendor") })}
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden grid-cols-[28px_minmax(0,1fr)_140px_120px_140px] items-center gap-3 bg-surface-sunken px-3 py-2 text-[12px] font-medium text-on-surface-muted sm:grid" aria-hidden>
                  <span />
                  <span>{t("vendorCredits.applyDialog.bill")}</span>
                  <span>{t("vendorCredits.applyDialog.due")}</span>
                  <span className="text-right">{t("vendorCredits.applyDialog.balance")}</span>
                  <span className="text-right">{t("vendorCredits.applyDialog.apply")}</span>
                </div>
                {bills.map((b) => {
                  const against = b.id === credit.billId;
                  const late = lateLabel(b, today);
                  const overdue = late?.endsWith("late");
                  return (
                    <div
                      key={b.id}
                      className={cn("grid grid-cols-[28px_minmax(0,1fr)_140px] items-center gap-3 border-t border-border px-3 py-2.5 text-[13px] sm:grid-cols-[28px_minmax(0,1fr)_140px_120px_140px]", against && "bg-info-bg/40")}
                      data-testid="bill-to-apply"
                    >
                      <Checkbox aria-label={t("vendorCredits.applyDialog.applyToBill", { number: b.billNumber })} checked={(amounts[b.id] ?? 0n) > 0n} onCheckedChange={(v) => toggle(b, v === true)} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-on-surface">
                          {b.billNumber}
                          {against && <span className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-medium text-primary">{t("vendorCredits.applyDialog.againstThisCredit")}</span>}
                        </p>
                        <p className="text-[12px] text-on-surface-muted">{t("vendorCredits.applyDialog.billDate", { date: calendarDate(b.date.slice(0, 10), today, locale) })}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-on-surface">{b.dueDate ? calendarDate(b.dueDate.slice(0, 10), today, locale) : t("vendorCredits.applyDialog.noDueDate")}</p>
                        {late && <p className={cn("text-[12px]", overdue ? "text-overdue" : "text-on-surface-muted")}>{late}</p>}
                      </div>
                      <span className="hidden text-right tabular-nums text-on-surface sm:block">{money(BigInt(b.balanceDue ?? "0"))}</span>
                      <MoneyInput aria-label={t("vendorCredits.applyDialog.amountToApply", { number: b.billNumber })} value={amounts[b.id] ?? 0n} onValueChange={(v) => setAmounts((prev) => ({ ...prev, [b.id]: v }))} currency={credit.currency} />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap justify-between gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-[13px] text-on-surface-muted" data-testid="apply-summary" aria-live="polite">
                <span>
                  {t("vendorCredits.applyDialog.applying")}
                  <b className="tabular-nums text-on-surface">{money(total)}</b>
                </span>
                <span className={cn(left < 0n && "text-overdue")}>
                  <b className="tabular-nums text-on-surface">{money(left < 0n ? 0n : left)}</b>
                  {t("vendorCredits.applyDialog.leftOn", { number: credit.number })}
                  {left < 0n && t("vendorCredits.applyDialog.moreThanItHas", { amount: money(-left) })}
                </span>
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("vendorCredits.applyDialog.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !bills?.length || total <= 0n}>
            {saving ? <Spinner size="sm" /> : <ArrowRightLeft size={14} aria-hidden />}
            {t("vendorCredits.applyDialog.applyAmount", { amount: money(total) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
