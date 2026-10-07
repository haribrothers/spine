"use client";

import { useEffect, useState } from "react";
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
import { formatMoney } from "../../../lib/money";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../vendor-bills/types";
import type { VendorCredit } from "./types";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-PUR-26 — `VendorRefundDialog`: money the vendor paid back against a credit (P25). Up to the credit's balance. */
export function VendorRefundDialog({ open, onOpenChange, credit, onRecorded }: { open: boolean; onOpenChange: (open: boolean) => void; credit: VendorCredit; onRecorded: () => void }) {
  const balance = BigInt(credit.balanceAmount);
  const [amount, setAmount] = useState<bigint>(balance);
  const [date, setDate] = useState<Date>(new Date());
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(balance);
    setDate(new Date());
    setMethod("bank_transfer");
    setReference("");
    setError(null);
  }, [open, balance]);

  async function handleSave() {
    setError(null);
    if (amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amount > balance) {
      setError(`This credit has ${formatMoney(balance, credit.currency)} left to refund.`);
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/vendor-credits/${credit.id}/refunds`, { amount: amount.toString(), date: iso(date), moneyAccountId: moneyAccountId || null, method, reference: reference.trim() || null });
      onOpenChange(false);
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this refund.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record a refund from {credit.contactName}</DialogTitle>
          <DialogDescription>Money the vendor paid back against {credit.number}. Up to {formatMoney(balance, credit.currency)}.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={credit.currency} />}
            </FormField>
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
            <MoneyAccountPicker form="refund" direction="in" value={moneyAccountId} onValueChange={setMoneyAccountId} />
            <FormField label="Method" required>
              {(field) => (
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Record refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
