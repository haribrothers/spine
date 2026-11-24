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
import { useT } from "../../../lib/i18n";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../vendor-bills/types";
import type { VendorCredit } from "./types";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-PUR-26 — `VendorRefundDialog`: money the vendor paid back against a credit (P25). Up to the credit's balance. */
export function VendorRefundDialog({ open, onOpenChange, credit, onRecorded }: { open: boolean; onOpenChange: (open: boolean) => void; credit: VendorCredit; onRecorded: (amount: bigint) => void }) {
  const t = useT();
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
      setError(t("vendorCredits.refundDialog.enterAmount"));
      return;
    }
    if (amount > balance) {
      setError(t("vendorCredits.refundDialog.creditLeft", { amount: formatMoney(balance, credit.currency) }));
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/vendor-credits/${credit.id}/refunds`, { amount: amount.toString(), date: iso(date), moneyAccountId: moneyAccountId || null, method, reference: reference.trim() || null });
      onOpenChange(false);
      onRecorded(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorCredits.refundDialog.recordFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("vendorCredits.refundDialog.title", { vendor: credit.contactName })}</DialogTitle>
          <DialogDescription>{t("vendorCredits.refundDialog.description", { number: credit.number, amount: formatMoney(balance, credit.currency) })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t("vendorCredits.refundDialog.amount")} required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={credit.currency} />}
            </FormField>
            <FormField label={t("vendorCredits.refundDialog.date")} required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
            <MoneyAccountPicker form="refund" direction="in" value={moneyAccountId} onValueChange={setMoneyAccountId} />
            <FormField label={t("vendorCredits.refundDialog.method")} required>
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
          <FormField label={t("vendorCredits.refundDialog.reference")}>
            {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("vendorCredits.refundDialog.optional")} maxLength={120} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("vendorCredits.refundDialog.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t("vendorCredits.refundDialog.recordRefund")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
