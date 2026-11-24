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
  useConfirm,
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
import { AiField } from "../../../components/ai-suggested-tag";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { formatMoney } from "../../../lib/money";
import { formatDay, toIsoDate } from "./dates";

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
  initialAccountId,
}: {
  direction: BankTransactionDirection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccount[];
  currency: string;
  onRecorded: (entry: BankTransaction) => void;
  /** US-BANK-09 — from a statement line: account, amount and date are fixed. */
  prefill?: StatementPrefill;
  /** US-BANK-15 — opened from an account (its row or its register): that account is chosen. */
  initialAccountId?: string;
}) {
  const t = useT();
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
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    setMoneyAccountId(prefill?.moneyAccountId ?? (initialAccountId && accounts.some((a) => a.id === initialAccountId) ? initialAccountId : undefined) ?? accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
    setDate(prefill ? prefillDate(prefill) : new Date());
    setCategoryId(prefill?.ai?.categoryAccountId ?? "");
    setAmount(prefill?.amount ?? 0n);
    setTaxRateId(NO_TAX);
    setContactId(prefill?.ai?.contactId ?? NO_CONTACT);
    setDescription(prefill?.description ?? "");
    setError(null);
    apiClient
      .get<Record<string, LedgerAccount[]>>("/org/accounts")
      .then((grouped) => setLedger(Object.values(grouped).flat()))
      .catch(() => setLedger([]));
    apiClient.get<{ id: string; name: string; archivedAt: string | null }[]>("/contacts?picker=1").then(setContacts).catch(() => {});
    if (!isIn) apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
  }, [open, accounts, isIn, prefill, initialAccountId]);

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
      setError(isIn ? t("banking.moneyInOut.chooseIn") : t("banking.moneyInOut.chooseOut"));
      return;
    }
    if (amount <= 0n) {
      setError(t("banking.moneyInOut.amountRequired"));
      return;
    }
    // US-BANK-15 (D-218): recording asks first, saying what posts where.
    const accountName = accounts.find((a) => a.id === moneyAccountId)?.name ?? t("banking.moneyInOut.theAccount");
    const categoryName = categories.find((a) => a.id === categoryId)?.name ?? t("banking.moneyInOut.theCategory");
    const amountText = formatMoney(amount, currency);
    const ok = await confirm({
      title: isIn ? t("banking.moneyInOut.confirmInTitle") : t("banking.moneyInOut.confirmOutTitle"),
      description: t(isIn ? "banking.moneyInOut.confirmInBody" : "banking.moneyInOut.confirmOutBody", {
        amount: amountText,
        account: accountName,
        category: categoryName,
        date: formatDay(toIsoDate(date)),
        tax: taxAmount > 0n ? t("banking.moneyInOut.confirmTax", { amount: formatMoney(taxAmount, currency) }) : "",
      }),
      confirmLabel: t("banking.moneyInOut.record"),
      cancelLabel: t("banking.explorer.goBack"),
    });
    if (!ok) return;
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
      setError(err instanceof Error ? err.message : t("banking.moneyInOut.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isIn ? t("banking.moneyInOut.titleIn") : t("banking.moneyInOut.titleOut")}</DialogTitle>
          <DialogDescription>{isIn ? t("banking.moneyInOut.descriptionIn") : t("banking.moneyInOut.descriptionOut")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={isIn ? t("banking.moneyInOut.intoAccount") : t("banking.moneyInOut.fromAccount")} required>
              {(field) => (
                <Select value={moneyAccountId} onValueChange={setMoneyAccountId} disabled={Boolean(prefill)}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder={t("banking.moneyInOut.chooseAccount")} />
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
            <FormField label={t("banking.moneyInOut.date")} required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
          </div>

          <AiField suggested={Boolean(prefill?.ai?.categoryAccountId) && categoryId === prefill?.ai?.categoryAccountId}>
          <FormField label={t("banking.moneyInOut.category")} required helperText={t("banking.moneyInOut.categoryHelp", { hint: CONTROL_ACCOUNT_HINT.toLowerCase() })}>
            {(field) => (
              <div className="flex flex-col gap-2">
                {shortcuts.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("banking.moneyInOut.categoryShortcuts")}>
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
                  placeholder={t("banking.moneyInOut.chooseCategory")}
                  emptyText={t("banking.moneyInOut.noMatchingAccount", { hint: CONTROL_ACCOUNT_HINT })}
                />
              </div>
            )}
          </FormField>
          </AiField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label={t("banking.moneyInOut.amount")}
              required
              helperText={!isIn && taxAmount > 0n ? t("banking.moneyInOut.includesTax", { amount: formatMoney(taxAmount, currency) }) : undefined}
            >
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} disabled={Boolean(prefill)} />}
            </FormField>
            {!isIn && (
              <FormField label={t("banking.moneyInOut.tax")}>
                {(field) => (
                  <Select value={taxRateId} onValueChange={setTaxRateId}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TAX}>{t("banking.moneyInOut.noTax")}</SelectItem>
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
            <AiField suggested={Boolean(prefill?.ai?.contactId) && contactId === prefill?.ai?.contactId}>
            <FormField label={t("banking.moneyInOut.contact")}>
              {(field) => (
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>{t("banking.moneyInOut.noContact")}</SelectItem>
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
            </AiField>
            <FormField label={t("banking.moneyInOut.description")}>
              {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("banking.moneyInOut.optional")} maxLength={500} />}
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("banking.moneyInOut.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : isIn ? t("banking.moneyInOut.recordIn") : t("banking.moneyInOut.recordOut")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
