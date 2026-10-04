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
import { apiClient } from "../../../lib/api-client";
import { ContactPicker } from "./contact-picker";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./types";
import { formatMoney } from "../../../lib/money";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = (
  Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
).map(([value, label]) => ({ value, label }));

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
 * S-06.1/S-06.2/S-06.3/S-06.4/S-06.5's standalone entry point — the
 * invoice-triggered `invoices/record-payment-dialog.tsx` starts from a
 * specific invoice and its balance; this one starts from a contact instead
 * (there's no invoice to pre-fill from on the Payments list page), which is
 * exactly what S-06.4 ("record a payment with no invoice yet, held as
 * customer credit") needs a real entry point for — the invoice-triggered
 * dialog could only ever reach that outcome by opening from SOME invoice
 * and then not allocating to it, which was never a natural path to it.
 *
 * Same oldest-first suggestion + editable allocation table as the
 * invoice-triggered dialog (S-06.3), fetched fresh whenever the contact or
 * amount changes — duplicated rather than shared with
 * `invoices/record-payment-dialog.tsx` per this codebase's established
 * per-feature-folder convention (contact-picker.tsx/entity-toast.tsx are
 * duplicated the same way), and because this version has no
 * `presetInvoiceId` concept to reconcile against the suggestion.
 */
export function NewPaymentDialog({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}) {
  const [contactId, setContactId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[] | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContactId("");
    setAmount(0n);
    setDate(new Date());
    setMethod("bank_transfer");
    setReference("");
    setOutstanding(null);
    setAllocations([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !contactId) {
      setOutstanding(null);
      setAllocations([]);
      return;
    }
    apiClient
      .get<{ id: string; number: string | null; balanceDue: string; currency: string }[]>(
        `/invoices?contactId=${contactId}&status=issued`,
      )
      .then((invoices) => {
        setOutstanding(invoices.map((inv) => ({ id: inv.id, number: inv.number, balanceDue: inv.balanceDue })));
        if (invoices[0]?.currency) setCurrency(invoices[0].currency);
      })
      .catch(() => setOutstanding([]));
  }, [open, contactId]);

  // S-06.3 — re-suggests whenever the amount (or the outstanding-invoice
  // list) changes, matching invoices/record-payment-dialog.tsx's own
  // reasoning: a fresh amount deserves a fresh suggestion.
  useEffect(() => {
    if (!open || !contactId || !outstanding || amount <= 0n) {
      setAllocations([]);
      return;
    }
    apiClient
      .get<SuggestAllocationResponse>(`/payments/suggest-allocation?contactId=${contactId}&amount=${amount.toString()}`)
      .then((res) => {
        const byId = new Map(outstanding.map((inv) => [inv.id, inv]));
        setAllocations(
          res.allocations.map((a) => ({
            invoiceId: a.invoiceId,
            invoiceNumber: a.invoiceNumber,
            balanceDue: BigInt(byId.get(a.invoiceId)?.balanceDue ?? "0"),
            amount: BigInt(a.amount),
          })),
        );
      })
      .catch(() => {});
  }, [open, contactId, amount, outstanding]);

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
    if (!contactId) {
      setError("Select a contact.");
      return;
    }
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
            Pick a contact, then allocate the payment across their outstanding invoices, or leave any part unallocated as customer credit
            (S-06.4).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Contact" required>
              {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
            </FormField>
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
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} disabled={!contactId} />}
            </FormField>
          </div>

          {contactId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-on-surface">Allocation</h3>
                <span className="text-[12px] text-on-surface-muted">
                  Unallocated: {formatMoney(unallocated, currency)}
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
                          <SelectValue placeholder="Allocate to an invoice…" />
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

                  {outstanding.length === 0 && (
                    <p className="text-[12px] text-on-surface-muted">This contact has no outstanding issued invoices.</p>
                  )}
                </div>
              )}
            </div>
          )}
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
