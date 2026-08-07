"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Combobox,
  FormField,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { AccountsByType, CatalogItem } from "./types";

const NO_ACCOUNT = "none";

/**
 * Seed list for the currency Combobox — same fixed set
 * currency-locale-step.tsx (org onboarding/Settings) already offers, kept
 * in sync deliberately rather than importing across those route trees.
 * `allowCreate` isn't set on the currency Combobox (unlike unit/category)
 * since currency is a real ISO 4217 code validated server-side
 * (currencyCodeSchema), not an open-ended vocabulary — a currency missing
 * from this list should be added here, not typed ad hoc per item.
 */
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

interface DefaultTaxRate {
  name: string;
  percentage: number;
}

/**
 * S-02.1/S-02.3 — create or edit a catalog item: name/unit/category, a
 * default price (MoneyInput, minor units + currency, per CLAUDE.md's money
 * rule — never coupled to any document, see catalog.ts's schema comment),
 * a default tax rate percentage pre-filled from the org's single default
 * tax rate, and optional income/expense account mapping pulled from the
 * existing chart of accounts (`GET /org/accounts`).
 *
 * Self-contained like ContactForm — takes only `formId`/callbacks, no
 * document context — so this same component can be reused verbatim inside
 * a future Quotes line-item builder's "+ New item" inline flow (S-02.4)
 * without any change here.
 */
export function CatalogForm({
  formId,
  item,
  onSubmittingChange,
  onSuccess,
}: {
  formId: string;
  item?: CatalogItem;
  onSubmittingChange?: (saving: boolean) => void;
  onSuccess: (item: CatalogItem) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [currency, setCurrency] = useState(item?.defaultPriceCurrency ?? "USD");
  const [priceAmount, setPriceAmount] = useState<bigint>(item ? BigInt(item.defaultPriceAmount) : 0n);
  const [taxRatePercentage, setTaxRatePercentage] = useState(item?.defaultTaxRatePercentage ?? 0);
  const [incomeAccountId, setIncomeAccountId] = useState(item?.incomeAccountId ?? NO_ACCOUNT);
  const [expenseAccountId, setExpenseAccountId] = useState(item?.expenseAccountId ?? NO_ACCOUNT);
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);
  const [existingUnits, setExistingUnits] = useState<string[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Suggestion source for the Unit/Category comboboxes below — every
  // distinct value already in use across the org's catalogue (including
  // archived items, since a unit/category used on an archived item is
  // still a real, previously-typed value worth suggesting again).
  // Self-contained (this form fetches its own list rather than taking one
  // as a prop) per this component's own "no document context" design so
  // it stays reusable verbatim from a future Quotes inline "+ New item".
  useEffect(() => {
    apiClient
      .get<CatalogItem[]>("/catalog-items?includeArchived=true")
      .then((rows) => {
        setExistingUnits(Array.from(new Set(rows.map((row) => row.unit).filter(Boolean))).sort());
        setExistingCategories(
          Array.from(new Set(rows.map((row) => row.category).filter((c): c is string => Boolean(c)))).sort(),
        );
      })
      .catch(() => {});
  }, []);

  // Pre-fill currency/tax rate from org defaults, but only for a brand-new
  // item — an existing item's own stored values always win (they may have
  // been intentionally set differently from the org's current default).
  useEffect(() => {
    if (item) return;
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
    apiClient
      .get<DefaultTaxRate>("/org/tax/default-rate")
      .then((rate) => setTaxRatePercentage(rate.percentage))
      .catch(() => {});
  }, [item]);

  useEffect(() => {
    apiClient
      .get<AccountsByType>("/org/accounts")
      .then(setAccounts)
      .catch(() => setAccounts(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmittingChange?.(true);
    setError(null);
    try {
      const payload = {
        name,
        description: description || undefined,
        unit,
        category: category || undefined,
        defaultPriceAmount: priceAmount.toString(),
        defaultPriceCurrency: currency,
        defaultTaxRatePercentage: taxRatePercentage,
        incomeAccountId: incomeAccountId === NO_ACCOUNT ? undefined : incomeAccountId,
        expenseAccountId: expenseAccountId === NO_ACCOUNT ? undefined : expenseAccountId,
      };
      const saved = item
        ? await apiClient.put<CatalogItem>(`/catalog-items/${item.id}`, payload)
        : await apiClient.post<CatalogItem>("/catalog-items", payload);
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item.");
      onSubmittingChange?.(false);
    }
  }

  const incomeAccounts = accounts?.income ?? [];
  const expenseAccounts = accounts?.expense ?? [];
  const unitOptions = useMemo(() => existingUnits.map((u) => ({ value: u, label: u })), [existingUnits]);
  const categoryOptions = useMemo(() => existingCategories.map((c) => ({ value: c, label: c })), [existingCategories]);
  // The org's current default currency always appears even if it isn't in
  // the fixed common-currency list, so a non-default org default is still
  // selectable without falling back to free text.
  const currencyOptions = useMemo(() => {
    const codes = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];
    return codes.map((code) => ({ value: code, label: code }));
  }, [currency]);

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField label="Name" required>
        {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required />}
      </FormField>

      <FormField label="Description">
        {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Unit" required helperText="e.g. hour, sq ft, each">
          {(field) => (
            <Combobox
              {...field}
              options={unitOptions}
              value={unit}
              onValueChange={setUnit}
              allowCreate
              placeholder="Select or type a unit…"
              emptyText="Type to create a new unit."
            />
          )}
        </FormField>

        <FormField label="Category" helperText="Free text, optional">
          {(field) => (
            <Combobox
              {...field}
              options={categoryOptions}
              value={category}
              onValueChange={setCategory}
              allowCreate
              placeholder="Select or type a category…"
              emptyText="Type to create a new category."
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Default price" required>
          {(field) => (
            <MoneyInput {...field} value={priceAmount} onValueChange={setPriceAmount} currency={currency} />
          )}
        </FormField>

        <FormField label="Currency" required>
          {(field) => (
            <Combobox {...field} options={currencyOptions} value={currency} onValueChange={setCurrency} />
          )}
        </FormField>
      </div>

      <FormField label="Default tax rate (%)" helperText="Pre-filled from the org's default rate; editable per item.">
        {(field) => (
          <Input
            {...field}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={String(taxRatePercentage)}
            onChange={(e) => setTaxRatePercentage(Number(e.target.value) || 0)}
            className="w-32"
          />
        )}
      </FormField>

      <FormField label="Default income account" helperText="Used when this item appears on an invoice line.">
        {(field) => (
          <Select value={incomeAccountId} onValueChange={setIncomeAccountId}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>None</SelectItem>
              {incomeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormField label="Default expense account" helperText="Used when this item appears on a purchase/expense line.">
        {(field) => (
          <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>None</SelectItem>
              {expenseAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
    </form>
  );
}
