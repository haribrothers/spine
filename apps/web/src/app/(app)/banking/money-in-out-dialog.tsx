"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
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
  cn,
} from "@spine/ui";
import {
  BANK_TRANSACTION_SHORTCUTS,
  CONTROL_ACCOUNT_CODES,
  CONTROL_ACCOUNT_HINT,
  computeLineTax,
  money,
  type BankTransaction,
  type BankTransactionDirection,
  type MoneyAccount,
} from "@spine/shared";
import { prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { toIsoDate } from "./dates";

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
}

interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  archivedAt: string | null;
}

const NO_TAX = "__none__";
const NO_CONTACT = "__none__";
const CONTROL: ReadonlySet<string> = new Set(CONTROL_ACCOUNT_CODES);

/**
 * US-BANK-05 — `MoneyInOutDialog`: money in or out that no invoice, bill or
 * payment covers. The category is any account except the control accounts
 * and the money accounts themselves; shortcuts pick the usual ones.
 */
export function MoneyInOutDialog({
  direction,
  open,
  onOpenChange,
  accounts,
  currency,
  onRecorded,
  prefill,
}: {
  direction: BankTransactionDirection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccount[];
  currency: string;
  onRecorded: (entry: BankTransaction) => void;
  /** US-BANK-09 — from a statement line: account, amount and date are fixed. */
  prefill?: StatementPrefill;
}) {
  const isIn = direction === "in";
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [taxRateId, setTaxRateId] = useState(NO_TAX);
  const [contactId, setContactId] = useState(NO_CONTACT);
  const [description, setDescription] = useState("");
  const [ledger, setLedger] = useState<LedgerAccount[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; archivedAt: string | null }[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMoneyAccountId(prefill?.moneyAccountId ?? accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
    setDate(prefill ? prefillDate(prefill) : new Date());
    setCategoryId("");
    setAmount(prefill?.amount ?? 0n);
    setTaxRateId(NO_TAX);
    setContactId(NO_CONTACT);
    setDescription(prefill?.description ?? "");
    setError(null);
    apiClient
      .get<Record<string, LedgerAccount[]>>("/org/accounts")
      .then((grouped) => setLedger(Object.values(grouped).flat()))
      .catch(() => setLedger([]));
    apiClient.get<{ id: string; name: string; archivedAt: string | null }[]>("/contacts").then(setContacts).catch(() => {});
    if (!isIn) apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
  }, [open, accounts, isIn, prefill]);

  // Money accounts move by transfer, control accounts by their own documents.
  const categories = useMemo(() => {
    const moneyLedgerIds = new Set(accounts.map((a) => a.accountId));
    return ledger.filter((a) => !CONTROL.has(a.code) && !moneyLedgerIds.has(a.id)).sort((a, b) => a.code.localeCompare(b.code));
  }, [ledger, accounts]);
  const shortcuts = BANK_TRANSACTION_SHORTCUTS.filter((s) => s.direction === direction)
    .map((s) => ({ ...s, account: categories.find((a) => a.code === s.code) }))
    .filter((s) => s.account);

  const rate = taxRates.find((r) => r.id === taxRateId);
  const taxAmount = rate && amount > 0n ? computeLineTax(money(amount, currency), [{ id: rate.id, name: rate.name, percent: rate.rate, isCompound: rate.isCompound }], true).taxAmount.amount : 0n;

  async function handleSubmit() {
    setError(null);
    if (!moneyAccountId || !categoryId) {
      setError(isIn ? "Choose the account the money went into and a category." : "Choose the account the money came out of and a category.");
      return;
    }
    if (amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const entry = await apiClient.post<BankTransaction>("/bank-transactions", {
        moneyAccountId,
        direction,
        accountId: categoryId,
        contactId: contactId === NO_CONTACT ? null : contactId,
        amount: amount.toString(),
        taxRateId: !isIn && taxRateId !== NO_TAX ? taxRateId : null,
        date: toIsoDate(date),
        description: description.trim() || null,
      });
      onOpenChange(false);
      onRecorded(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isIn ? "Money in" : "Money out"}</DialogTitle>
          <DialogDescription>{isIn ? "Money that came into an account without an invoice or payment." : "Money that left an account without a bill or expense."}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={isIn ? "Into account" : "From account"} required>
              {(field) => (
                <Select value={moneyAccountId} onValueChange={setMoneyAccountId} disabled={Boolean(prefill)}>
                  <SelectTrigger id={field.id}>
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
              )}
            </FormField>
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
          </div>

          <FormField label="Category" required helperText={`Or pick any account. Receivables, payables, tax and customer advances aren't offered — ${CONTROL_ACCOUNT_HINT.toLowerCase()}`}>
            {(field) => (
              <div className="flex flex-col gap-2">
                {shortcuts.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Category shortcuts">
                    {shortcuts.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        aria-pressed={categoryId === s.account!.id}
                        onClick={() => setCategoryId(s.account!.id)}
                        className={cn(
                          "min-h-11 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:min-h-8",
                          categoryId === s.account!.id ? "border-primary bg-primary/10 text-primary" : "border-border-strong bg-surface text-on-surface hover:bg-surface-sunken",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <Combobox
                  id={field.id}
                  aria-describedby={field["aria-describedby"]}
                  options={categories.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
                  value={categoryId || undefined}
                  onValueChange={setCategoryId}
                  placeholder="Choose a category…"
                  emptyText={`No matching account. ${CONTROL_ACCOUNT_HINT}`}
                />
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" required helperText={!isIn && taxAmount > 0n ? `Includes ${formatMoney(taxAmount, currency)} tax, which goes to Input Tax Receivable.` : undefined}>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} disabled={Boolean(prefill)} />}
            </FormField>
            {!isIn && (
              <FormField label="Tax">
                {(field) => (
                  <Select value={taxRateId} onValueChange={setTaxRateId}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TAX}>No tax</SelectItem>
                      {taxRates
                        .filter((r) => !r.archivedAt)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
            <FormField label="Contact">
              {(field) => (
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>No contact</SelectItem>
                    {contacts
                      .filter((c) => !c.archivedAt)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Description">
              {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" maxLength={500} />}
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : isIn ? "Record money in" : "Record money out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
