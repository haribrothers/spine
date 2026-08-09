"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../lib/api-client";

type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

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

interface SuggestAllocationResponse {
  allocations: { invoiceId: string; invoiceNumber: string | null; amount: string }[];
  unallocatedAmount: string;
}

/**
 * S-06.1/S-06.2/S-06.3/S-06.4/S-06.5 — records a payment against a contact
 * and (optionally) allocates it across that contact's outstanding invoices.
 * Invoice-triggered (lives in the invoices/ folder, not a standalone
 * /payments page — see CHANGELOG's own scope note on why a full payments
 * list page was judged not worth building yet).
 *
 * `contactId` and, when opened from an invoice's own "Record payment"
 * button, `presetInvoiceId`/`presetBalanceDue` come from the caller. On
 * open, this fetches every OTHER outstanding invoice for the contact (via
 * `GET /invoices?contactId=&status=issued`) so a payment can be split
 * across more than just the triggering invoice (S-06.2) — the preset
 * invoice is merged into that same list rather than special-cased, so the
 * allocation table is uniform.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  presetInvoiceId,
  presetBalanceDue,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string | null;
  presetInvoiceId?: string;
  presetBalanceDue?: bigint;
  onRecorded: () => void;
}) {
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState<bigint>(presetBalanceDue ?? 0n);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[] | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(presetBalanceDue ?? 0n);
    setDate(new Date());
    setError(null);

    apiClient
      .get<{ id: string; number: string | null; balanceDue: string; currency: string }[]>(
        `/invoices?contactId=${contactId}&status=issued`,
      )
      .then((invoices) => {
        setOutstanding(invoices.map((inv) => ({ id: inv.id, number: inv.number, balanceDue: inv.balanceDue })));
        if (invoices[0]?.currency) setCurrency(invoices[0].currency);
      })
      .catch(() => setOutstanding([]));
  }, [open, contactId, presetBalanceDue]);

  // S-06.3 — once the payment amount and outstanding invoices are both
  // known, ask the server for an oldest-due-first suggested split and use
  // it to seed the editable allocation table. Re-runs whenever amount
  // changes so adjusting the payment amount refreshes the suggestion,
  // matching the story's "so I usually just confirm" framing (a fresh
  // amount deserves a fresh suggestion, not a stale one silently kept).
  //
  // When opened from a specific invoice's own "Record payment" button
  // (`presetInvoiceId` set), that invoice is guaranteed a spot in the
  // suggestion even if it isn't the oldest-due one — the whole point of
  // clicking "Record payment" from an invoice's own page is to pay THAT
  // invoice, so the server's oldest-first ordering shouldn't silently
  // skip it in favor of an older invoice the user wasn't looking at.
  useEffect(() => {
    if (!open || !outstanding || amount <= 0n) {
      setAllocations([]);
      return;
    }
    apiClient
      .get<SuggestAllocationResponse>(`/payments/suggest-allocation?contactId=${contactId}&amount=${amount.toString()}`)
      .then((res) => {
        const byId = new Map(outstanding.map((inv) => [inv.id, inv]));
        let suggested = res.allocations.map((a) => ({
          invoiceId: a.invoiceId,
          invoiceNumber: a.invoiceNumber,
          balanceDue: BigInt(byId.get(a.invoiceId)?.balanceDue ?? "0"),
          amount: BigInt(a.amount),
        }));

        if (presetInvoiceId && !suggested.some((row) => row.invoiceId === presetInvoiceId)) {
          const presetInvoice = byId.get(presetInvoiceId);
          if (presetInvoice) {
            const presetBalance = BigInt(presetInvoice.balanceDue);
            const already = suggested.reduce((sum, row) => sum + row.amount, 0n);
            const room = amount - already;
            if (room > 0n) {
              suggested = [
                {
                  invoiceId: presetInvoiceId,
                  invoiceNumber: presetInvoice.number,
                  balanceDue: presetBalance,
                  amount: room < presetBalance ? room : presetBalance,
                },
                ...suggested,
              ];
            }
          }
        }

        setAllocations(suggested);
      })
      .catch(() => {});
  }, [open, contactId, amount, outstanding, presetInvoiceId]);

  const totalAllocated = useMemo(() => allocations.reduce((sum, a) => sum + a.amount, 0n), [allocations]);
  const unallocated = amount - totalAllocated;

  const unallocatedInvoices = useMemo(() => {
    const allocatedIds = new Set(allocations.map((a) => a.invoiceId));
    return (outstanding ?? []).filter((inv) => !allocatedIds.has(inv.id));
  }, [outstanding, allocations]);

  function updateAllocationAmount(invoiceId: string, next: bigint) {
    setAllocations((rows) => rows.map((row) => (row.invoiceId === invoiceId ? { ...row, amount: next } : row)));
  }

  function removeAllocation(invoiceId: string) {
    setAllocations((rows) => rows.filter((row) => row.invoiceId !== invoiceId));
  }

  function addAllocationRow(invoiceId: string) {
    const invoice = outstanding?.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    const balance = BigInt(invoice.balanceDue);
    const room = unallocated > 0n ? unallocated : 0n;
    setAllocations((rows) => [
      ...rows,
      { invoiceId, invoiceNumber: invoice.number, balanceDue: balance, amount: room < balance ? room : balance },
    ]);
  }

  async function handleSubmit() {
    setError(null);
    if (amount <= 0n) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (totalAllocated > amount) {
      setError("Total allocated cannot exceed the payment amount.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/payments", {
        contactId,
        date: date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        method,
        reference: reference || null,
        currency,
        amount: amount.toString(),
        allocations: allocations.filter((a) => a.amount > 0n).map((a) => ({ invoiceId: a.invoiceId, amount: a.amount.toString() })),
      });
      onOpenChange(false);
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {contactName ? `From ${contactName}.` : "From this contact."} Allocate it across outstanding invoices, or leave any part
            unallocated as customer credit (S-06.4).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
            <FormField label="Method" required>
              {() => (
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Reference" helperText="Cheque number, transaction ID, etc.">
              {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />}
            </FormField>
            <FormField label="Amount" required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-on-surface">Allocation</h3>
              <span className="text-[12px] text-on-surface-muted">
                Unallocated: {toDecimalString({ amount: unallocated, currency })} {currency}
              </span>
            </div>

            {outstanding === null ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                {allocations.length === 0 && (
                  <p className="text-[13px] text-on-surface-muted">
                    No invoice allocated — this payment will sit as unallocated customer credit until applied later.
                  </p>
                )}
                {allocations.map((row) => (
                  <div key={row.invoiceId} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[13px] font-medium text-on-surface">{row.invoiceNumber ?? "—"}</span>
                    <span className="w-28 shrink-0 text-[12px] text-on-surface-muted">
                      Balance {toDecimalString({ amount: row.balanceDue, currency })}
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
                        <SelectValue placeholder="Allocate to another invoice…" />
                      </SelectTrigger>
                      <SelectContent>
                        {unallocatedInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.number ?? "Unnumbered"} — balance {toDecimalString({ amount: BigInt(inv.balanceDue), currency })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
