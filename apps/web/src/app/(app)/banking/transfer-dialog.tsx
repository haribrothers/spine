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
  useConfirm,
} from "@spine/ui";
import { SAME_ACCOUNT_TRANSFER, type BankTransfer, type MoneyAccount } from "@spine/shared";
import { prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { formatMoney } from "../../../lib/money";
import { formatDay, toIsoDate } from "./dates";

function AccountSelect({ id, accounts, value, onValueChange, disabled }: { id: string; accounts: MoneyAccount[]; value: string; onValueChange: (v: string) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("banking.transfer.chooseAccount")} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * US-BANK-04 — `TransferDialog`: move money between two of the
 * organisation's own accounts (a deposit, a top-up or paying off a card).
 */
export function TransferDialog({
  open,
  onOpenChange,
  accounts,
  currency,
  onRecorded,
  prefill,
  initialAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccount[];
  currency: string;
  onRecorded: (transfer: BankTransfer) => void;
  /** US-BANK-09 — from a statement line: the line's account is one side (the "to" side for money in), and amount and date are fixed. */
  prefill?: StatementPrefill & { direction: "in" | "out" };
  /** US-BANK-15 — opened from an account: it's the From side. */
  initialAccountId?: string;
}) {
  const t = useT();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [date, setDate] = useState<Date>(new Date());
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setFromId(prefill.direction === "out" ? prefill.moneyAccountId : "");
      setToId(prefill.direction === "in" ? prefill.moneyAccountId : "");
    } else {
      setFromId((initialAccountId && accounts.some((a) => a.id === initialAccountId) ? initialAccountId : undefined) ?? accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
      setToId("");
    }
    setAmount(prefill?.amount ?? 0n);
    setDate(prefill ? prefillDate(prefill) : new Date());
    setReference(prefill?.reference ?? "");
    setError(null);
  }, [open, accounts, prefill, initialAccountId]);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const sameAccount = Boolean(fromId) && fromId === toId;

  async function handleSubmit() {
    setError(null);
    if (!fromId || !toId) {
      setError(t("banking.transfer.chooseBoth"));
      return;
    }
    if (fromId === toId) {
      setError(SAME_ACCOUNT_TRANSFER);
      return;
    }
    if (amount <= 0n) {
      setError(t("banking.transfer.amountRequired"));
      return;
    }
    // US-BANK-15 (D-218): moving money asks first.
    const ok = await confirm({
      title: t("banking.transfer.confirmTitle", { amount: formatMoney(amount, currency), from: from?.name ?? t("banking.transfer.theAccount"), to: to?.name ?? t("banking.transfer.theAccount") }),
      description: t("banking.transfer.confirmBody", { date: formatDay(toIsoDate(date)) }),
      confirmLabel: t("banking.transfer.moveMoney"),
      cancelLabel: t("banking.explorer.goBack"),
    });
    if (!ok) return;
    setSaving(true);
    try {
      const transfer = await apiClient.post<BankTransfer>("/bank-transfers", { fromMoneyAccountId: fromId, toMoneyAccountId: toId, amount: amount.toString(), date: toIsoDate(date), reference: reference.trim() || null });
      onOpenChange(false);
      onRecorded(transfer);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.transfer.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("banking.transfer.title")}</DialogTitle>
          <DialogDescription>{t("banking.transfer.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t("banking.transfer.from")} required>
              {(field) => <AccountSelect id={field.id} accounts={accounts} value={fromId} onValueChange={setFromId} disabled={prefill?.direction === "out"} />}
            </FormField>
            <FormField label={t("banking.transfer.to")} required>
              {(field) => <AccountSelect id={field.id} accounts={accounts} value={toId} onValueChange={setToId} disabled={prefill?.direction === "in"} />}
            </FormField>
            <FormField label={t("banking.transfer.amount")} required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} disabled={Boolean(prefill)} />}
            </FormField>
            <FormField label={t("banking.transfer.date")} required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
          </div>
          <FormField label={t("banking.transfer.reference")}>
            {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("banking.transfer.optional")} maxLength={120} />}
          </FormField>
          {sameAccount && (
            <p role="alert" className="text-[13px] font-medium text-overdue">
              {SAME_ACCOUNT_TRANSFER}
            </p>
          )}
          {from && to && from.id !== to.id && (
            <p className="text-[13px] text-on-surface-muted">
              {t("banking.transfer.posts", { to: to.name, from: from.name })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("banking.transfer.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || sameAccount}>
            {saving ? <Spinner size="sm" /> : t("banking.transfer.moveMoney")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
