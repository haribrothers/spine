"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Combobox, Input, MoneyInput } from "@spine/ui";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { AccountOption, CatalogItemOption, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";

/**
 * Client-side line shape while editing — money fields as `bigint` (never a
 * float), matching MoneyInput's own contract. Structurally identical to
 * invoices/invoice-line-editor.tsx's EditableInvoiceLine MINUS
 * `discountPercentage` (vendor_bill_lines has no discount field — see
 * vendorBillLineInputSchema's own doc comment: a vendor's own discount, if
 * any, is reflected directly in the unit price) PLUS `accountId` (the
 * Expense/COGS account this line debits at record() time). Every vendor
 * bill line here is implicitly an "item" line — there's no heading/text
 * line type offered in the editor UI even though the schema technically
 * allows it, since a vendor bill has no PDF/document-presentation need for
 * section headings the way an invoice/quote does; kept for schema parity
 * only. Duplicated rather than shared, matching invoices'/quotes' own
 * per-document-type independence.
 */
export interface EditableVendorBillLine {
  key: string; // stable React key across reorders — not sent to the server
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPriceAmount: bigint;
  accountId: string | null;
  /** Legacy flat fallback, used only when neither taxRateId nor taxGroupId is set. */
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  /** US-TAX-11 — why the line has no tax; null on heading and text lines. */
  supplyClass: SupplyClass | null;
}

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `bill-line-${Date.now()}-${keySeq}`;
}

export function blankLine(): EditableVendorBillLine {
  return {
    key: newKey(),
    type: "item",
    catalogItemId: null,
    name: "",
    description: "",
    quantity: 1,
    unitPriceAmount: 0n,
    accountId: null,
    taxRatePercentage: 0,
    taxRateId: null,
    taxGroupId: null,
    isTaxInclusive: false,
    supplyClass: "zero_rated",
  };
}

/** Resolves a line's chosen tax rate/group into `computeLineTax`'s input shape — mirrors invoices/invoice-line-editor.tsx's identical helper. */
function resolveLineTaxRates(
  line: EditableVendorBillLine,
  taxRates: TaxRateOption[],
  taxGroups: TaxGroupOption[],
): ComputeTaxRate[] {
  if (line.taxRateId) {
    const rate = taxRates.find((r) => r.id === line.taxRateId);
    return rate ? [{ id: rate.id, name: rate.name, percent: rate.rate, isCompound: rate.isCompound }] : [];
  }
  if (line.taxGroupId) {
    const group = taxGroups.find((g) => g.id === line.taxGroupId);
    return group ? group.taxRates.map((r) => ({ id: r.id, name: r.name, percent: r.rate, isCompound: r.isCompound })) : [];
  }
  return line.taxRatePercentage > 0 ? [{ id: "line", name: "Tax", percent: line.taxRatePercentage, isCompound: false }] : [];
}

/**
 * Computes this line's pre-tax subtotal and tax using the SAME shared
 * `computeLineTax` engine the server uses (packages/shared/src/tax/tax.ts)
 * — so the number shown while editing matches what the server will store.
 * Purely for instant client-side feedback; the server remains the sole
 * source of truth and recomputes everything from scratch on every save.
 */
export function computeLinePreview(
  line: EditableVendorBillLine,
  currency: string,
  taxRates: TaxRateOption[] = [],
  taxGroups: TaxGroupOption[] = [],
) {
  // US-TAX-07: the same exact shared line maths the server uses, so the preview matches to the cent.
  const computed = computeDocumentLine({
    quantity: line.quantity,
    unitPriceAmount: BigInt(line.unitPriceAmount),
    currency,
    rates: resolveLineTaxRates(line, taxRates, taxGroups),
    inclusive: line.isTaxInclusive,
  });
  return { subtotal: computed.netAmount, tax: computed.tax.taxAmount.amount, total: computed.tax.total.amount };
}

/**
 * The multi-line editor: add/remove/reorder item lines, each with a
 * catalog-item prefill, qty/unit price, an Expense/COGS account picker
 * (`GET /org/accounts`, filtered to `type: "expense"`, mirroring
 * catalog-form.tsx's own account-select grouping), a tax picker (rate or
 * group), and an inclusive checkbox — no discount field (see
 * EditableVendorBillLine's own doc comment). No drag-and-drop, matching
 * invoices/invoice-line-editor.tsx's own reasoning (a bounded line list
 * doesn't need one, and buttons keep it fully keyboard-operable).
 */
export function VendorBillLineEditor({
  lines,
  onChange,
  currency,
  supplyType = null,
  flaggedKeys,
}: {
  /** US-TAX-13 — picks each item's intra- or inter-state tax. */
  supplyType?: SupplyType | null;
  /** US-TAX-13 — lines changed by hand when the place of supply changed. */
  flaggedKeys?: Set<string>;
  lines: EditableVendorBillLine[];
  onChange: (lines: EditableVendorBillLine[]) => void;
  currency: string;
}) {
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    apiClient
      .get<CatalogItemOption[]>("/catalog-items")
      .then(setCatalogItems)
      .catch(() => {});
    apiClient
      .get<TaxRateOption[]>("/tax-rates")
      .then(setTaxRates)
      .catch(() => {});
    apiClient
      .get<TaxGroupOption[]>("/tax-groups")
      .then(setTaxGroups)
      .catch(() => {});
    apiClient
      .get<Record<string, AccountOption[]>>("/org/accounts")
      .then((res) => setExpenseAccounts(res.expense ?? []))
      .catch(() => {});
  }, []);

  const catalogOptions = useMemo(
    () => catalogItems.filter((i) => !i.archivedAt).map((i) => ({ value: i.id, label: i.name })),
    [catalogItems],
  );

  const accountOptions = useMemo(
    () => expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [expenseAccounts],
  );

  const taxOptions = useMemo(
    () => [
      { value: "", label: "No tax" },
      ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: `rate:${r.id}`, label: `${r.name} (${r.rate}%)` })),
      ...taxGroups
        .filter((g) => !g.archivedAt)
        .map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join("+")})` })),
    ],
    [taxRates, taxGroups],
  );

  function updateLine(index: number, patch: Partial<EditableVendorBillLine>) {
    const next = lines.slice();
    const merged = { ...next[index]!, ...patch };
    // US-TAX-11: the supply type follows the tax and the catalogue item.
    next[index] = withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId));
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    const next = lines.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  }

  function addLine() {
    onChange([...lines, blankLine()]);
  }

  function applyCatalogItem(index: number, catalogItemId: string) {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return;
    updateLine(index, {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      accountId: item.expenseAccountId,
      taxRatePercentage: item.defaultTaxRateId || item.defaultTaxGroupId ? 0 : item.defaultTaxRatePercentage,
      // US-TAX-13: the item's inter-state tax outside my state.
      ...itemTaxFor(item, supplyType),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const preview = computeLinePreview(line, currency, taxRates, taxGroups);
          const taxPercent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
          const taxValue = line.taxRateId ? `rate:${line.taxRateId}` : line.taxGroupId ? `group:${line.taxGroupId}` : "";

          function applyTaxSelection(value: string) {
            if (value.startsWith("rate:")) {
              updateLine(index, { taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
            } else if (value.startsWith("group:")) {
              updateLine(index, { taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
            } else {
              updateLine(index, { taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
            }
          }

          return (
            <div key={line.key} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    aria-label="Move line up"
                    disabled={index === 0}
                    onClick={() => moveLine(index, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move line down"
                    disabled={index === lines.length - 1}
                    onClick={() => moveLine(index, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className="flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input value={line.name} onChange={(e) => updateLine(index, { name: e.target.value })} placeholder="Item name" required />
                      <div className="w-48">
                        <Combobox
                          options={catalogOptions}
                          value={line.catalogItemId ?? undefined}
                          onValueChange={(id) => applyCatalogItem(index, id)}
                          placeholder="Prefill from catalogue…"
                        />
                      </div>
                    </div>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Description (optional)"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <FieldLabel label="Qty">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={String(line.quantity)}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        />
                      </FieldLabel>
                      <FieldLabel label="Unit price">
                        <MoneyInput value={line.unitPriceAmount} onValueChange={(v) => updateLine(index, { unitPriceAmount: v })} currency={currency} />
                      </FieldLabel>
                      <FieldLabel label="Line total">
                        <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 text-[14px] tabular-nums">
                          {formatMoney(preview.total, currency)}
                        </div>
                      </FieldLabel>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldLabel label="Expense/COGS account">
                        <Combobox
                          options={accountOptions}
                          value={line.accountId ?? undefined}
                          onValueChange={(id) => updateLine(index, { accountId: id })}
                          placeholder="Select an account…"
                        />
                      </FieldLabel>
                      <FieldLabel label="Tax">
                        <Combobox options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder="No tax" />
                      </FieldLabel>
                    </div>
                    <label className="flex h-10 w-fit cursor-pointer items-center gap-2 pb-0.5">
                      <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => updateLine(index, { isTaxInclusive: v === true })} />
                      <span className="text-[13px] text-on-surface">Price includes tax</span>
                    </label>
                    {flaggedKeys?.has(line.key) && <LineTaxWarning />}
                    {showsSupplyType(line.supplyClass, taxPercent) && (
                      <SupplyTypeField value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => updateLine(index, { supplyClass })} />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => removeLine(index)}
                  className="mt-1 flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-muted hover:bg-overdue-bg hover:text-overdue"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          <Plus size={14} /> Add line
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-on-surface-muted">{label}</span>
      {children}
    </div>
  );
}
