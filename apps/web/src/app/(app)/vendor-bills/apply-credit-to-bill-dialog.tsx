"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, MoneyInput, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { useT } from "../../../lib/i18n";
import type { VendorBill } from "./types";

interface OpenCredit {
  id: string;
  number: string | null;
  vendorReference: string | null;
  date: string;
  balanceAmount: string;
}

/** The vendor's open credits, oldest first, filled up to what the bill still owes. */
export function fillCredits(credits: { id: string; balanceAmount: string }[], balance: bigint): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  let left = balance;
  for (const c of credits) {
    const take = left > 0n ? (BigInt(c.balanceAmount) < left ? BigInt(c.balanceAmount) : left) : 0n;
    out[c.id] = take;
    left -= take;
  }
  return out;
}

/**
 * US-PUR-33 (D-225) — put the vendor's open credit against this bill: their
 * credits, oldest first, filled up to the balance; the button says how much
 * is applied, so the dialog is the confirmation (D-218). Applying posts
 * nothing (P24a) — one `POST /vendor-credits/:id/apply` per credit used.
 */
export function ApplyCreditToBillDialog({ bill, open, onOpenChange, onApplied }: { bill: Pick<VendorBill, "id" | "billNumber" | "contactId" | "contactName" | "currency" | "balanceDue">; open: boolean; onOpenChange: (open: boolean) => void; onApplied: (total: bigint) => void }) {
  const t = useT();
  const [credits, setCredits] = useState<OpenCredit[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, bigint>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const balance = BigInt(bill.balanceDue);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCredits(null);
    apiClient
      .get<OpenCredit[]>(`/vendor-credits?contactId=${bill.contactId}&status=open`)
      .then((rows) => {
        const oldest = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        setCredits(oldest);
        setAmounts(fillCredits(oldest, balance));
      })
      .catch(() => setCredits([]));
  }, [open, bill.contactId, balance]);

  const total = useMemo(() => Object.values(amounts).reduce((s, v) => s + v, 0n), [amounts]);
  const money = (v: bigint) => formatMoney(v, bill.currency);

  async function apply() {
    if (total <= 0n) return setError(t("vendorBills.applyCredit.enterAmount"));
    if (total > balance) return setError(t("vendorBills.applyCredit.upTo", { amount: money(balance) }));
    setSaving(true);
    setError(null);
    try {
      for (const c of credits ?? []) {
        const amount = amounts[c.id] ?? 0n;
        if (amount > 0n) await apiClient.post(`/vendor-credits/${c.id}/apply`, { allocations: [{ billId: bill.id, amount: amount.toString() }] });
      }
      onOpenChange(false);
      onApplied(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorBills.applyCredit.applyFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("vendorBills.applyCredit.title", { number: bill.billNumber })}</DialogTitle>
          <DialogDescription>
            {t("vendorBills.applyCredit.description", { vendor: bill.contactName ?? t("vendorBills.applyCredit.theVendor"), amount: money(balance) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!credits ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : credits.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{t("vendorBills.applyCredit.noCredit")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border" data-testid="bill-credits">
              {credits.map((c) => (
                <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto_10rem] items-center gap-3 px-3 py-2 text-[13px]">
                  <span>
                    <span className="font-medium text-on-surface">{c.number ?? t("vendorBills.applyCredit.credit")}</span>
                    {c.vendorReference && <span className="text-on-surface-muted">{t("vendorBills.applyCredit.theirReference", { reference: c.vendorReference })}</span>}
                    <span className="block text-[12px] text-on-surface-muted">{calendarDate(c.date, new Date(), orgLocaleTag())}</span>
                  </span>
                  <span className="whitespace-nowrap text-on-surface-muted">{t("vendorBills.applyCredit.left", { amount: money(BigInt(c.balanceAmount)) })}</span>
                  <MoneyInput
                    aria-label={t("vendorBills.applyCredit.applyFrom", { number: c.number ?? t("vendorBills.applyCredit.thisCredit") })}
                    value={amounts[c.id] ?? 0n}
                    currency={bill.currency}
                    onValueChange={(v) => setAmounts((cur) => ({ ...cur, [c.id]: v > BigInt(c.balanceAmount) ? BigInt(c.balanceAmount) : v }))}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("vendorBills.applyCredit.goBack")}
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={saving || !credits?.length || total <= 0n}>
            {saving ? <Spinner size="sm" /> : t("vendorBills.applyCredit.apply", { amount: money(total) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
