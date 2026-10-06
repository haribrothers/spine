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
import { SAME_ACCOUNT_TRANSFER, type BankTransfer, type MoneyAccount } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { toIsoDate } from "./dates";

function AccountSelect({ id, accounts, value, onValueChange }: { id: string; accounts: MoneyAccount[]; value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Choose an account" />
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccount[];
  currency: string;
  onRecorded: (transfer: BankTransfer) => void;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [date, setDate] = useState<Date>(new Date());
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFromId(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
    setToId("");
    setAmount(0n);
    setDate(new Date());
    setReference("");
    setError(null);
  }, [open, accounts]);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);

  async function handleSubmit() {
    setError(null);
    if (!fromId || !toId) {
      setError("Choose the account the money left and the one it went to.");
      return;
    }
    if (fromId === toId) {
      setError(SAME_ACCOUNT_TRANSFER);
      return;
    }
    if (amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const transfer = await apiClient.post<BankTransfer>("/bank-transfers", { fromMoneyAccountId: fromId, toMoneyAccountId: toId, amount: amount.toString(), date: toIsoDate(date), reference: reference.trim() || null });
      onOpenChange(false);
      onRecorded(transfer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this transfer. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>Move money between your own accounts — a deposit, a top-up or paying off a card.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="From" required>
              {(field) => <AccountSelect id={field.id} accounts={accounts} value={fromId} onValueChange={setFromId} />}
            </FormField>
            <FormField label="To" required>
              {(field) => <AccountSelect id={field.id} accounts={accounts} value={toId} onValueChange={setToId} />}
            </FormField>
            <FormField label="Amount" required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
          </div>
          <FormField label="Reference">
            {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" maxLength={120} />}
          </FormField>
          {from && to && from.id !== to.id && (
            <p className="text-[13px] text-on-surface-muted">
              Posts Dr {to.name} / Cr {from.name}. Both registers show it.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Move money"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
