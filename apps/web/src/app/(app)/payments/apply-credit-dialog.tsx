"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { Payment } from "./types";
import { formatMoney } from "../../../lib/money";

interface OutstandingInvoice {
  id: string;
  number: string | null;
  balanceDue: string;
}

interface AllocationRow {
  invoiceId: string;
  invoiceNumber: string | null;
  balanceDue: bigint;
  amount: bigint;
}

/**
 * S-05.5's other half — applies a payment's sitting unallocated credit
 * (S-06.4) against one or more invoices that weren't available when the
 * payment was first recorded. Deliberately a much smaller form than
 * `RecordPaymentDialog` — no date/method/amount fields, since nothing new
 * is being recorded, only existing credit being reclassified against a
 * fixed pool (`payment.unallocatedAmount`, shown as the running ceiling
 * rather than an editable amount).
 */
export function ApplyCreditDialog({
  open,
  onOpenChange,
  payment,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onApplied: () => void;
}) {
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[] | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !payment) return;
    setError(null);
    setAllocations([]);
    apiClient
      .get<{ id: string; number: string | null; balanceDue: string; currency: string; type: string }[]>(
        `/invoices?contactId=${payment.contactId}&status=issued`,
      )
      // S-05.4 — an advance invoice never posts to AR, so credit can't be applied against it (PaymentsService.applyCredit rejects it server-side too).
      .then((invoices) =>
        setOutstanding(invoices.filter((inv) => inv.type !== "advance").map((inv) => ({ id: inv.id, number: inv.number, balanceDue: inv.balanceDue }))),
      )
      .catch(() => setOutstanding([]));
  }, [open, payment]);

  if (!payment) return null;

  const currency = payment.currency;
  const creditAvailable = BigInt(payment.unallocatedAmount);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0n);
  const remaining = creditAvailable - totalAllocated;

  const unallocatedInvoices = (outstanding ?? []).filter((inv) => !allocations.some((a) => a.invoiceId === inv.id));

  function addAllocationRow(invoiceId: string) {
    const invoice = outstanding?.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    const balance = BigInt(invoice.balanceDue);
    const room = remaining > 0n ? remaining : 0n;
    setAllocations((rows) => [
      ...rows,
      { invoiceId, invoiceNumber: invoice.number, balanceDue: balance, amount: room < balance ? room : balance },
    ]);
  }

  function updateAllocationAmount(invoiceId: string, next: bigint) {
    setAllocations((rows) => rows.map((row) => (row.invoiceId === invoiceId ? { ...row, amount: next } : row)));
  }

  function removeAllocation(invoiceId: string) {
    setAllocations((rows) => rows.filter((row) => row.invoiceId !== invoiceId));
  }

  async function handleSubmit() {
    if (!payment) return;
    setError(null);
    if (allocations.length === 0 || totalAllocated <= 0n) {
      setError("Allocate at least some credit to an invoice.");
      return;
    }
    if (totalAllocated > creditAvailable) {
      setError("Total allocated cannot exceed this payment's unallocated credit.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/payments/${payment.id}/apply-credit`, {
        allocations: allocations.filter((a) => a.amount > 0n).map((a) => ({ invoiceId: a.invoiceId, amount: a.amount.toString() })),
      });
      onOpenChange(false);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply this credit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Apply credit</DialogTitle>
          <DialogDescription>
            {payment.number ?? "This payment"} has {formatMoney(creditAvailable, currency)} sitting as
            unallocated customer credit. Apply it against one or more outstanding invoices.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-on-surface">Allocation</h3>
            <span className="text-[12px] text-on-surface-muted">
              Remaining credit: {formatMoney(remaining, currency)}
            </span>
          </div>

          {outstanding === null ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : outstanding.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">This contact has no outstanding issued invoices to apply credit to.</p>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              {allocations.length === 0 && <p className="text-[13px] text-on-surface-muted">No invoice selected yet.</p>}
              {allocations.map((row) => (
                <div key={row.invoiceId} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[13px] font-medium text-on-surface">{row.invoiceNumber ?? "—"}</span>
                  <span className="w-28 shrink-0 text-[12px] text-on-surface-muted">
                    Balance {formatMoney(row.balanceDue, currency)}
                  </span>
                  <div className="flex-1">
                    <MoneyInput
                      value={row.amount}
                      onValueChange={(v) => updateAllocationAmount(row.invoiceId, v > row.balanceDue ? row.balanceDue : v)}
                      currency={currency}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove allocation to ${row.invoiceNumber ?? "invoice"}`}
                    onClick={() => removeAllocation(row.invoiceId)}
                    className="shrink-0 text-[12px] text-on-surface-muted underline hover:text-overdue"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {unallocatedInvoices.length > 0 && (
                <div className="pt-1">
                  <Select value="" onValueChange={addAllocationRow}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Apply to another invoice…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unallocatedInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.number ?? "Unnumbered"} — balance {formatMoney(BigInt(inv.balanceDue), currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || allocations.length === 0}>
            {saving ? <Spinner size="sm" /> : "Apply credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
