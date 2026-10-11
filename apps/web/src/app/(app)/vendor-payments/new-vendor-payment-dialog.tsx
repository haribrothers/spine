"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { localIsoDate, prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import { MoneyAccountPicker } from "../../../components/money-account-picker";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = (
  Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
).map(([value, label]) => ({ value, label }));

interface OutstandingBill {
  id: string;
  billNumber: string;
  balanceDue: string;
}

interface AllocationRow {
  billId: string;
  billNumber: string;
  balanceDue: bigint;
  amount: bigint;
}

interface SuggestAllocationResponse {
  allocations: { billId: string; billNumber: string; amount: string }[];
  unallocatedAmount: string;
}

/**
 * S-07.8's standalone entry point for recording a payment to a vendor,
 * mirroring payments/new-payment-dialog.tsx's exact composition. The one
 * real behavioral difference — enforced here, not just server-side —
 * is that allocations must sum to EXACTLY the payment amount, since
 * FEAT-07 has no "held as vendor credit" concept (see
 * createVendorPaymentSchema's own doc comment): submit is disabled until
 * `remaining === 0n`, not merely `<= 0n`, and the running indicator below
 * reads "Remaining to allocate" rather than payments/new-payment-dialog.tsx's
 * "Unallocated" (which is a legitimate end state on the customer side, not
 * here).
 */
export function NewVendorPaymentDialog({
  open,
  onOpenChange,
  onRecorded,
  prefill,
  initialContactId,
  initialBillId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the recorded payment (US-BANK-09 matches it to a statement line). */
  onRecorded: (payment?: { id: string }) => void;
  /** US-BANK-09 — from a statement line: amount, date and account are fixed. */
  prefill?: StatementPrefill;
  /** US-DASH-13 — "Pay bill" opens the dialog on that bill's vendor. */
  initialContactId?: string;
  /** US-PUR-33 — and with that bill ticked for its balance (the amount filled to match). */
  initialBillId?: string;
}) {
  const [contactId, setContactId] = useState("");
  // US-PUR-25: the vendor's open credit, offered before paying.
  const [openCredit, setOpenCredit] = useState<{ total: bigint; vendor: string; href: string } | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [outstanding, setOutstanding] = useState<OutstandingBill[] | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // US-PUR-33: the amount the preset bill filled in; the oldest-first suggestion waits until the amount changes.
  const pinnedAmount = useRef<bigint | null>(null);

  useEffect(() => {
    if (!open) return;
    setContactId(initialContactId ?? "");
    setAmount(prefill?.amount ?? 0n);
    setDate(prefill ? prefillDate(prefill) : new Date());
    setMethod("bank_transfer");
    setReference(prefill?.reference ?? "");
    setOutstanding(null);
    setAllocations([]);
    setError(null);
    pinnedAmount.current = null;
  }, [open, initialContactId, prefill]);

  useEffect(() => {
    if (!open || !contactId) {
      setOpenCredit(null);
      return;
    }
    apiClient
      .get<{ id: string; balanceAmount: string; contactName: string | null }[]>(`/vendor-credits?contactId=${contactId}&status=open`)
      .then((credits) => {
        const total = credits.reduce((sum, c) => sum + BigInt(c.balanceAmount), 0n);
        setOpenCredit(total > 0n ? { total, vendor: credits[0]!.contactName ?? "This vendor", href: credits.length === 1 ? `/vendor-credits/${credits[0]!.id}` : "/vendor-credits" } : null);
      })
      .catch(() => setOpenCredit(null));
  }, [open, contactId]);

  useEffect(() => {
    if (!open || !contactId) {
      setOutstanding(null);
      setAllocations([]);
      return;
    }
    apiClient
      .get<{ id: string; billNumber: string; balanceDue: string; currency: string }[]>(
        `/vendor-bills?contactId=${contactId}&status=recorded`,
      )
      .then((bills) => {
        setOutstanding(bills.map((b) => ({ id: b.id, billNumber: b.billNumber, balanceDue: b.balanceDue })));
        if (bills[0]?.currency) setCurrency(bills[0].currency);
        const preset = initialBillId && contactId === initialContactId ? bills.find((b) => b.id === initialBillId) : undefined;
        if (preset && !prefill) {
          const balance = BigInt(preset.balanceDue);
          pinnedAmount.current = balance;
          setCurrency(preset.currency);
          setAmount(balance);
          setAllocations([{ billId: preset.id, billNumber: preset.billNumber, balanceDue: balance, amount: balance }]);
        }
      })
      .catch(() => setOutstanding([]));
  }, [open, contactId, initialBillId, initialContactId, prefill]);

  useEffect(() => {
    if (pinnedAmount.current !== null && amount === pinnedAmount.current) return;
    pinnedAmount.current = null;
    if (!open || !contactId || !outstanding || amount <= 0n) {
      setAllocations([]);
      return;
    }
    apiClient
      .get<SuggestAllocationResponse>(`/vendor-payments/suggest-allocation?contactId=${contactId}&amount=${amount.toString()}`)
      .then((res) => {
        const byId = new Map(outstanding.map((b) => [b.id, b]));
        setAllocations(
          res.allocations.map((a) => ({
            billId: a.billId,
            billNumber: a.billNumber,
            balanceDue: BigInt(byId.get(a.billId)?.balanceDue ?? "0"),
            amount: BigInt(a.amount),
          })),
        );
      })
      .catch(() => {});
  }, [open, contactId, amount, outstanding]);

  const totalAllocated = useMemo(() => allocations.reduce((sum, a) => sum + a.amount, 0n), [allocations]);
  const remaining = amount - totalAllocated;

  const unallocatedBills = useMemo(() => {
    const allocatedIds = new Set(allocations.map((a) => a.billId));
    return (outstanding ?? []).filter((b) => !allocatedIds.has(b.id));
  }, [outstanding, allocations]);

  function updateAllocationAmount(billId: string, next: bigint) {
    setAllocations((rows) => rows.map((row) => (row.billId === billId ? { ...row, amount: next } : row)));
  }

  function removeAllocation(billId: string) {
    setAllocations((rows) => rows.filter((row) => row.billId !== billId));
  }

  function addAllocationRow(billId: string) {
    const bill = outstanding?.find((b) => b.id === billId);
    if (!bill) return;
    const balance = BigInt(bill.balanceDue);
    const room = remaining > 0n ? remaining : 0n;
    setAllocations((rows) => [
      ...rows,
      { billId, billNumber: bill.billNumber, balanceDue: balance, amount: room < balance ? room : balance },
    ]);
  }

  const canSubmit = contactId !== "" && amount > 0n && remaining === 0n;

  async function handleSubmit() {
    setError(null);
    if (!contactId) {
      setError("Select a vendor.");
      return;
    }
    if (amount <= 0n) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (remaining !== 0n) {
      setError("Allocations must sum to exactly the payment amount.");
      return;
    }
    setSaving(true);
    try {
      const recorded = await apiClient.post<{ id: string }>("/vendor-payments", {
        contactId,
        date: localIsoDate(date ?? new Date()),
        method,
        reference: reference || null,
        moneyAccountId: prefill?.moneyAccountId ?? (moneyAccountId || null),
        currency,
        amount: amount.toString(),
        allocations: allocations.filter((a) => a.amount > 0n).map((a) => ({ billId: a.billId, amount: a.amount.toString() })),
      });
      onOpenChange(false);
      onRecorded(recorded);
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
          <DialogTitle>Record a vendor payment</DialogTitle>
          <DialogDescription>
            Pick a vendor, then allocate the full payment across their recorded bills — unlike a customer payment, this
            must be fully allocated before it can be saved.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {openCredit && (
            <Alert variant="info" data-testid="vendor-credit-note">
              <AlertDescription>
                {openCredit.vendor} has {formatMoney(openCredit.total, currency)} of credit.{" "}
                <a href={openCredit.href} className="font-medium text-primary underline">
                  Apply it first?
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Vendor" required>
              {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
            </FormField>
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
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
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} disabled={!contactId || Boolean(prefill)} />}
            </FormField>
            {prefill ? (
              <FormField label="Paid from" required>
                {() => <p className="py-2 text-[14px] text-on-surface">{prefill.moneyAccountName}</p>}
              </FormField>
            ) : (
              <MoneyAccountPicker form="vendor_payment" direction="out" value={moneyAccountId} onValueChange={setMoneyAccountId} />
            )}
          </div>

          {contactId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-on-surface">Allocation</h3>
                <span className={`text-[12px] ${remaining === 0n ? "text-paid" : "text-on-surface-muted"}`}>
                  Remaining to allocate: {formatMoney(remaining, currency)}
                </span>
              </div>

              {outstanding === null ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                  {allocations.length === 0 && (
                    <p className="text-[13px] text-on-surface-muted">
                      No bill allocated yet — allocate the full payment amount before saving.
                    </p>
                  )}
                  {allocations.map((row) => (
                    <div key={row.billId} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[13px] font-medium text-on-surface">{row.billNumber}</span>
                      <span className="w-28 shrink-0 text-[12px] text-on-surface-muted">
                        Balance {formatMoney(row.balanceDue, currency)}
                      </span>
                      <div className="flex-1">
                        <MoneyInput
                          value={row.amount}
                          onValueChange={(v) => updateAllocationAmount(row.billId, v > row.balanceDue ? row.balanceDue : v)}
                          currency={currency}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove allocation to ${row.billNumber}`}
                        onClick={() => removeAllocation(row.billId)}
                        className="shrink-0 text-[12px] text-on-surface-muted underline hover:text-overdue"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {unallocatedBills.length > 0 && (
                    <div className="pt-1">
                      <Select value="" onValueChange={addAllocationRow}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Allocate to a bill…" />
                        </SelectTrigger>
                        <SelectContent>
                          {unallocatedBills.map((bill) => (
                            <SelectItem key={bill.id} value={bill.id}>
                              {bill.billNumber} — balance {formatMoney(BigInt(bill.balanceDue), currency)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {outstanding.length === 0 && (
                    <p className="text-[12px] text-on-surface-muted">This vendor has no outstanding recorded bills.</p>
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
          <Button type="button" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? <Spinner size="sm" /> : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
