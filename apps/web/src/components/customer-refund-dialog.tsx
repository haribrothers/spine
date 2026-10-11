"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
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
  useConfirm,
} from "@spine/ui";
import type { CustomerRefund } from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { loadCustomerCredit, type CustomerCredit } from "../lib/customer-credit";
import { formatMoney } from "../lib/money";
import { MoneyAccountPicker } from "./money-account-picker";

const METHODS: { value: string; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * US-PAY-17 — `CustomerRefundDialog`: pay a customer back out of their
 * credit. Opened from a payment or credit note (that source preselected)
 * or from the contact (choose which credit). Up to the credit left.
 */
export function CustomerRefundDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  currency,
  sourceId,
  onRefunded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  currency: string;
  /** The payment or credit note to refund from; omitted, the person chooses. */
  sourceId?: string;
  onRefunded: (refund: CustomerRefund) => void;
}) {
  const [credits, setCredits] = useState<CustomerCredit[] | null>(null);
  const [chosenId, setChosenId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [date, setDate] = useState<Date>(new Date());
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCredits(null);
    setDate(new Date());
    setMethod("bank_transfer");
    setReference("");
    setSendConfirmation(false);
    loadCustomerCredit(contactId).then((list) => {
      setCredits(list);
      const start = list.find((c) => c.id === sourceId) ?? list[0];
      setChosenId(start?.id ?? "");
      setAmount(start?.available ?? 0n);
    });
  }, [open, contactId, sourceId]);

  const chosen = credits?.find((c) => c.id === chosenId);

  async function handleSubmit() {
    setError(null);
    if (!chosen) {
      setError("Choose the credit to refund from.");
      return;
    }
    if (amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amount > chosen.available) {
      setError(`You can refund up to ${formatMoney(chosen.available, currency)} from this ${chosen.kind === "payment" ? "payment" : "credit note"}.`);
      return;
    }
    setSaving(true);
    try {
      const refund = await apiClient.post<CustomerRefund>("/customer-refunds", {
        ...(chosen.kind === "payment" ? { sourcePaymentId: chosen.id } : { sourceCreditNoteId: chosen.id }),
        amount: amount.toString(),
        date: localIso(date),
        moneyAccountId: moneyAccountId || null,
        method,
        reference: reference.trim() || null,
        sendConfirmation,
      });
      onOpenChange(false);
      onRefunded(refund);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this refund. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Refund {contactName}</DialogTitle>
          <DialogDescription>Pay back credit the customer holds. The money leaves the account you choose, and their credit drops.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
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
            <p className="text-[13px] text-on-surface-muted">{contactName} has no credit to refund.</p>
          ) : (
            <>
              <FormField label="Refund from" required helperText={chosen ? `${formatMoney(chosen.available, currency)} of credit` : undefined}>
                {(field) => (
                  <Select
                    value={chosenId}
                    onValueChange={(v) => {
                      setChosenId(v);
                      setAmount(credits.find((c) => c.id === v)?.available ?? 0n);
                    }}
                  >
                    <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {credits.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Amount" required>
                  {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
                </FormField>
                <FormField label="Date" required>
                  {() => <DatePicker value={date} onChange={setDate} />}
                </FormField>
                <MoneyAccountPicker form="refund" direction="out" value={moneyAccountId} onValueChange={setMoneyAccountId} />
                <FormField label="Method" required>
                  {(field) => (
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger id={field.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </div>
              <FormField label="Reference">
                {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" maxLength={120} />}
              </FormField>
              <label htmlFor="refund-confirmation" className="flex cursor-pointer items-center gap-3 text-[14px] text-on-surface">
                <Checkbox id="refund-confirmation" checked={sendConfirmation} onCheckedChange={(v) => setSendConfirmation(v === true)} />
                Send refund confirmation
              </label>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !credits?.length}>
            {saving ? <Spinner size="sm" /> : "Record refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The toast after a refund: "Refunded $200.00 to Maple Ridge Developments", and whether the confirmation went. */
export function refundToast(refund: CustomerRefund): { title: string; description: string } {
  const title = `Refunded ${formatMoney(BigInt(refund.amount), refund.currency)} to ${refund.contactName}`;
  const description = refund.confirmation ? (refund.confirmation.sent ? "The customer has been emailed a confirmation." : (refund.confirmation.reason ?? "No confirmation was sent.")) : "Their credit has dropped by the same amount.";
  return { title, description };
}

/**
 * US-PAY-17 — the refunds taken from one payment or credit note, newest
 * first; "Delete refund" (with `payments.refund`) posts the reversal and
 * gives the credit back.
 */
export function RefundsSection({ contactId, sourceId, refreshKey, canRefund, onChanged }: { contactId: string; sourceId: string; refreshKey?: number; canRefund: boolean; onChanged: () => void }) {
  const [refunds, setRefunds] = useState<CustomerRefund[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<CustomerRefund[]>(`/customer-refunds?contactId=${contactId}`)
      .then((rows) => setRefunds(rows.filter((r) => r.source.id === sourceId)))
      .catch(() => setRefunds([]));
  }, [contactId, sourceId, refreshKey]);

  const { confirm, dialog: confirmDialog } = useConfirm();
  if (!refunds.length) return null;

  async function remove(refund: CustomerRefund) {
    const ok = await confirm({
      title: "Delete this refund?",
      description: `The ${formatMoney(BigInt(refund.amount), refund.currency)} refund is reversed in your books, and the customer's credit goes back up by that much.`,
      confirmLabel: "Delete refund",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setBusyId(refund.id);
    try {
      await apiClient.delete(`/customer-refunds/${refund.id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this refund.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="refunds">
      <h3 className="text-[13px] font-semibold text-on-surface-muted">Refunds</h3>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {refunds.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className={r.deletedAt ? "text-on-surface-muted line-through" : "text-on-surface"}>
            {new Date(`${r.date}T00:00:00`).toLocaleDateString()} · {r.moneyAccount.name}
            {r.reference ? ` · ${r.reference}` : ""}
          </span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums text-on-surface">{formatMoney(BigInt(r.amount), r.currency)}</span>
            {r.deletedAt ? (
              <span className="text-on-surface-muted">Deleted</span>
            ) : (
              canRefund && (
                <Button variant="ghost" size="sm" onClick={() => remove(r)} disabled={busyId === r.id} aria-label={`Delete refund of ${formatMoney(BigInt(r.amount), r.currency)}`}>
                  Delete refund
                </Button>
              )
            )}
          </span>
        </div>
      ))}
      {confirmDialog}
    </div>
  );
}
