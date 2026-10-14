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
import { HSN_SAC_MESSAGE, SUPPLY_CLASSES, SUPPLY_CLASS_LABELS, isValidHsnSac, supplyClassTaxError, type SupplyClass, type TaxChoice, type TaxProfile } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { supplyClassForTax } from "../../../components/supply-type-field";
import type { AccountsByType, CatalogItem, TaxGroupOption, TaxRateOption } from "./types";

const NO_ACCOUNT = "none";
const NO_TAX = "";

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
  prefill,
  onSubmittingChange,
  onSuccess,
}: {
  formId: string;
  item?: CatalogItem;
  /** US-CAT-12 — a new item filled from another (Duplicate); saving creates a new item. */
  prefill?: CatalogItem;
  onSubmittingChange?: (saving: boolean) => void;
  onSuccess: (item: CatalogItem) => void;
}) {
  const source = item ?? prefill;
  const [name, setName] = useState(source?.name ?? "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [unit, setUnit] = useState(source?.unit ?? "");
  const [category, setCategory] = useState(source?.category ?? "");
  const [currency, setCurrency] = useState(source?.defaultPriceCurrency ?? "USD");
  const [priceAmount, setPriceAmount] = useState<bigint>(source ? BigInt(source.defaultPriceAmount) : 0n);
  const [taxSelection, setTaxSelection] = useState(() =>
    source?.defaultTaxRateId ? `rate:${source.defaultTaxRateId}` : source?.defaultTaxGroupId ? `group:${source.defaultTaxGroupId}` : NO_TAX,
  );
  // US-TAX-13 — in India an item has an intra-state (above) and an inter-state tax.
  const [interSelection, setInterSelection] = useState(() =>
    source?.interTaxRateId ? `rate:${source.interTaxRateId}` : source?.interTaxGroupId ? `group:${source.interTaxGroupId}` : NO_TAX,
  );
  const [gst, setGst] = useState(false);
  // US-TAX-14 — the item's HSN (goods) or SAC (services) code.
  const [hsnSac, setHsnSac] = useState(source?.hsnSac ?? "");
  const [supplyClass, setSupplyClass] = useState<SupplyClass>(source?.supplyClass ?? "zero_rated");
  const [incomeAccountId, setIncomeAccountId] = useState(source?.incomeAccountId ?? NO_ACCOUNT);
  const [expenseAccountId, setExpenseAccountId] = useState(source?.expenseAccountId ?? NO_ACCOUNT);
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
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

  // Pre-fill currency from org defaults, but only for a brand-new item — an
  // existing item's own stored values always win (they may have been
  // intentionally set differently from the org's current default).
  useEffect(() => {
    if (source) return;
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [source]);

  useEffect(() => {
    apiClient
      .get<AccountsByType>("/org/accounts")
      .then(setAccounts)
      .catch(() => setAccounts(null));
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient
      .get<TaxProfile & { defaultIntraTax?: TaxChoice | null; defaultInterTax?: TaxChoice | null }>("/org/tax/profile")
      .then((profile) => {
        if (profile.country !== "IN") return;
        setGst(true);
        if (source) return;
        // A new item starts from Settings › Tax › "Default tax preference".
        const token = (t: TaxChoice | null | undefined) => (t?.taxRateId ? `rate:${t.taxRateId}` : t?.taxGroupId ? `group:${t.taxGroupId}` : NO_TAX);
        setTaxSelection(token(profile.defaultIntraTax));
        setInterSelection(token(profile.defaultInterTax));
        if (profile.defaultIntraTax?.taxRateId || profile.defaultIntraTax?.taxGroupId) setSupplyClass("taxable");
      })
      .catch(() => {});
  }, [source]);

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
        defaultTaxRateId: taxSelection.startsWith("rate:") ? taxSelection.slice(5) : null,
        defaultTaxGroupId: taxSelection.startsWith("group:") ? taxSelection.slice(6) : null,
        ...(gst
          ? {
              hsnSac: hsnSac || null,
              interTaxRateId: interSelection.startsWith("rate:") ? interSelection.slice(5) : null,
              interTaxGroupId: interSelection.startsWith("group:") ? interSelection.slice(6) : null,
            }
          : {}),
        supplyClass,
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

  /** US-TAX-11 — the rate the chosen tax adds up to. */
  function taxPercentOf(selection: string): number {
    if (selection.startsWith("rate:")) return taxRates.find((r) => r.id === selection.slice(5))?.rate ?? 0;
    if (selection.startsWith("group:")) return taxGroups.find((g) => g.id === selection.slice(6))?.taxRates.reduce((sum, r) => sum + r.rate, 0) ?? 0;
    return 0;
  }
  const supplyError = supplyClassTaxError(supplyClass, taxPercentOf(taxSelection));

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
  const taxOptions = useMemo(
    () => [
      { value: NO_TAX, label: "No tax" },
      ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: `rate:${r.id}`, label: `${r.name} (${r.rate}%)` })),
      ...taxGroups
        .filter((g) => !g.archivedAt)
        .map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join("+")})` })),
    ],
    [taxRates, taxGroups],
  );

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">Details</h3>
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

      <h3 className="mt-2 border-t border-border pt-4 text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">Price and tax</h3>
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

      {gst && (
        <FormField
          label="HSN/SAC code"
          helperText="4, 6 or 8 digits. Copied to each line; change it there if needed."
          errorText={hsnSac && !isValidHsnSac(hsnSac) ? HSN_SAC_MESSAGE : undefined}
        >
          {(field) => <Input {...field} inputMode="numeric" maxLength={8} value={hsnSac} onChange={(e) => setHsnSac(e.target.value.replace(/\D/g, ""))} />}
        </FormField>
      )}

      {gst ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Intra-state tax" helperText="Same state as your business.">
            {(field) => (
              <Combobox
                {...field}
                options={taxOptions}
                value={taxSelection}
                onValueChange={(v) => {
                  setTaxSelection(v);
                  setSupplyClass((current) => supplyClassForTax(current, taxPercentOf(v), null, v.startsWith("rate:") ? taxRates.find((r) => r.id === v.slice(5))?.supplyClass : null));
                }}
                placeholder="No tax"
              />
            )}
          </FormField>
          <FormField label="Inter-state tax" helperText="Another state, export or SEZ.">
            {(field) => <Combobox {...field} options={taxOptions} value={interSelection} onValueChange={setInterSelection} placeholder="No tax" />}
          </FormField>
        </div>
      ) : (
        <FormField label="Default tax" helperText="Pre-fills a new quote/invoice line for this item; editable per line.">
          {(field) => (
            <Combobox
              {...field}
              options={taxOptions}
              value={taxSelection}
              onValueChange={(v) => {
                setTaxSelection(v);
                setSupplyClass((current) => supplyClassForTax(current, taxPercentOf(v), null, v.startsWith("rate:") ? taxRates.find((r) => r.id === v.slice(5))?.supplyClass : null));
              }}
              placeholder="No tax"
            />
          )}
        </FormField>
      )}

      <FormField
        label="Supply type"
        helperText="Zero-rated, exempt and non-taxable items have no tax and are reported separately."
        errorText={supplyError ?? undefined}
      >
        {(field) => (
          <Select value={supplyClass} onValueChange={(v) => setSupplyClass(v as SupplyClass)}>
            <SelectTrigger {...field}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPLY_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {SUPPLY_CLASS_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <h3 className="mt-2 border-t border-border pt-4 text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">Accounts</h3>
      <FormField label="Default income account" helperText="Used when this item appears on an invoice line.">
        {(field) => (
          <Select value={incomeAccountId} onValueChange={setIncomeAccountId}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>None — posts to 4100 Sales — Services</SelectItem>
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
