"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, MoneyInput, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { VendorBill } from "../vendor-bills/types";
import type { VendorCredit } from "./types";

/**
 * US-PUR-25 — `ApplyVendorCreditDialog`: the vendor's open bills, oldest
 * first, with "Amount to apply" prefilled oldest-first from the credit's
 * balance. Nothing posts (P24a); the bills' balances and the credit's drop.
 */
export function ApplyVendorCreditDialog({ open, onOpenChange, credit, onApplied }: { open: boolean; onOpenChange: (open: boolean) => void; credit: VendorCredit; onApplied: () => void }) {
  const [bills, setBills] = useState<VendorBill[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, bigint>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = BigInt(credit.balanceAmount);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBills(null);
    apiClient.get<VendorBill[]>(`/vendor-bills?contactId=${credit.contactId}&status=recorded`).then((rows) => {
      const openBills = rows.filter((b) => BigInt(b.balanceDue ?? "0") > 0n).sort((a, b) => a.date.localeCompare(b.date));
      setBills(openBills);
      let left = balance;
      const prefill: Record<string, bigint> = {};
      for (const b of openBills) {
        const due = BigInt(b.balanceDue ?? "0");
        prefill[b.id] = left < due ? left : due;
        left -= prefill[b.id]!;
      }
      setAmounts(prefill);
    });
  }, [open, credit.contactId, balance]);

  const total = useMemo(() => Object.values(amounts).reduce((sum, a) => sum + a, 0n), [amounts]);

  async function handleSave() {
    setError(null);
    for (const b of bills ?? []) {
      const due = BigInt(b.balanceDue ?? "0");
      if ((amounts[b.id] ?? 0n) > due) {
        setError(`You can apply up to ${formatMoney(due, credit.currency)} to this bill.`);
        return;
      }
    }
    if (total > balance) {
      setError(`This credit has ${formatMoney(balance, credit.currency)} left to apply.`);
      return;
    }
    const allocations = (bills ?? []).filter((b) => (amounts[b.id] ?? 0n) > 0n).map((b) => ({ billId: b.id, amount: amounts[b.id]!.toString() }));
    if (!allocations.length) {
      setError("Enter an amount for at least one bill.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/vendor-credits/${credit.id}/apply`, { allocations });
      onOpenChange(false);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply the credit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Apply {credit.number} to bills</DialogTitle>
          <DialogDescription>
            {formatMoney(balance, credit.currency)} to use against {credit.contactName}&apos;s open bills, oldest first. Nothing is posted; what you owe on each bill drops.
          </DialogDescription>
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
            <p className="text-[13px] text-on-surface-muted">{credit.contactName} has no open bills.</p>
          ) : (
            bills.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3" data-testid="bill-to-apply">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-on-surface">Bill {b.billNumber}</p>
                  <p className="text-[12px] text-on-surface-muted">
                    {new Date(b.date).toLocaleDateString()} · {formatMoney(BigInt(b.balanceDue ?? "0"), credit.currency)} owed
                  </p>
                </div>
                <div className="w-36">
                  <MoneyInput aria-label={`Amount to apply to bill ${b.billNumber}`} value={amounts[b.id] ?? 0n} onValueChange={(v) => setAmounts((prev) => ({ ...prev, [b.id]: v }))} currency={credit.currency} />
                </div>
              </div>
            ))
          )}
          {bills && bills.length > 0 && <p className="text-[13px] text-on-surface-muted">Applying {formatMoney(total, credit.currency)}.</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !bills?.length}>
            {saving ? <Spinner size="sm" /> : "Apply credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
