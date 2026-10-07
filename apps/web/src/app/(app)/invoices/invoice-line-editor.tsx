"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Combobox, Input, MoneyInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { LineItemPicker, type PickerBundle } from "../../../components/line-item-picker";
import { bundleLines, useBundles } from "../../../lib/bundles";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { CatalogItemOption, InvoiceLineType, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";

/** Client-side line shape while editing — money fields as `bigint` (never a float), matching MoneyInput's own contract. Not the same as the API's InvoiceLine (which serializes bigints as strings and includes server-computed fields this component doesn't need pre-save). Structurally identical to quotes/quote-line-editor.tsx's EditableQuoteLine — duplicated rather than shared, matching invoices.service.ts's own precedent on why the two document types stay independently owned. */
export interface EditableInvoiceLine {
  key: string; // stable React key across reorders — not sent to the server
  type: InvoiceLineType;
  catalogItemId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPriceAmount: bigint;
  discountPercentage: number;
  /** Legacy flat fallback, used only when neither taxRateId nor taxGroupId is set. */
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  /** US-TAX-11 — why the line has no tax; null on heading and text lines. */
  supplyClass: SupplyClass | null;
  /** US-TAX-14 — the line's HSN/SAC code ("" when none). */
  hsnSac: string;
}

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `line-${Date.now()}-${keySeq}`;
}

export function blankLine(type: InvoiceLineType = "item"): EditableInvoiceLine {
  return {
    key: newKey(),
    type,
    catalogItemId: null,
    name: "",
    description: "",
    quantity: type === "item" ? 1 : 0,
    unitPriceAmount: 0n,
    discountPercentage: 0,
    taxRatePercentage: 0,
    taxRateId: null,
    taxGroupId: null,
    isTaxInclusive: false,
    supplyClass: type === "item" ? "zero_rated" : null,
    hsnSac: "",
  };
}

/** Resolves a line's chosen tax rate/group into `computeLineTax`'s input shape — mirrors quotes/quote-line-editor.tsx's identical helper. Falls back to the legacy flat percentage when neither is set. */
function resolveLineTaxRates(
  line: EditableInvoiceLine,
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
 * Computes this line's post-discount, pre-tax subtotal and tax using the
 * SAME shared `computeLineTax` engine the server uses (packages/shared/src/
 * tax/tax.ts) — so the number shown while editing matches what the server
 * will store, without duplicating tax math. Purely for instant client-side
 * feedback; the server remains the sole source of truth and recomputes
 * everything from scratch on every save.
 */
export function computeLinePreview(
  line: EditableInvoiceLine,
  currency: string,
  taxRates: TaxRateOption[] = [],
  taxGroups: TaxGroupOption[] = [],
) {
  if (line.type !== "item") {
    return { subtotal: 0n, tax: 0n, total: 0n };
  }
  // US-TAX-07: the same exact shared line maths the server uses, so the preview matches to the cent.
  const computed = computeDocumentLine({
    quantity: line.quantity,
    unitPriceAmount: BigInt(line.unitPriceAmount),
    discountPercentage: line.discountPercentage,
    currency,
    rates: resolveLineTaxRates(line, taxRates, taxGroups),
    inclusive: line.isTaxInclusive,
  });
  return { subtotal: computed.netAmount, tax: computed.tax.taxAmount.amount, total: computed.tax.total.amount };
}

/**
 * The multi-line editor: add item/heading/text lines, per-line quantity/
 * price/discount/tax for item lines, remove, and reorder via up/down
 * buttons — no drag-and-drop library, matching quotes/quote-line-editor.tsx's
 * own reasoning (a bounded per-invoice line list doesn't need one, and
 * buttons keep it fully keyboard-operable).
 */
export function InvoiceLineEditor({
  lines,
  onChange,
  currency,
  supplyType = null,
  exportUnderLut = false,
  flaggedKeys,
  showHsn = false,
}: {
  /** US-TAX-13 — picks each item's intra- or inter-state tax. */
  supplyType?: SupplyType | null;
  /** D-181 — exports under LUT have no IGST. */
  exportUnderLut?: boolean;
  /** US-TAX-13 — lines changed by hand when the place of supply changed. */
  flaggedKeys?: Set<string>;
  /** US-TAX-14 — show HSN/SAC on item lines (GST is on). */
  showHsn?: boolean;
  lines: EditableInvoiceLine[];
  onChange: (lines: EditableInvoiceLine[]) => void;
  currency: string;
}) {
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);

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
  }, []);

  // US-QUO-26: the same item picker as quotes, with bundles in this invoice's currency.
  const { bundles, pickerBundles } = useBundles(currency);

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

  function updateLine(index: number, patch: Partial<EditableInvoiceLine>) {
    const next = lines.slice();
    const merged = { ...next[index]!, ...patch };
    // US-TAX-11: the supply type follows the tax and the catalogue item.
    next[index] = withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
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

  function addLine(type: InvoiceLineType) {
    onChange([...lines, blankLine(type)]);
  }

  /** Replaces the line the bundle was picked on with the bundle's lines, in order. */
  function insertBundle(index: number, bundleId: string) {
    const bundle = bundles.find((b) => b.id === bundleId);
    if (!bundle) return;
    const activeIds = new Set(catalogItems.filter((i) => !i.archivedAt).map((i) => i.id));
    const added = bundleLines(bundle, activeIds).map((fields) => ({ ...blankLine(fields.type), ...fields }));
    onChange([...lines.slice(0, index), ...added, ...lines.slice(index + 1)]);
  }

  function applyCatalogItem(index: number, catalogItemId: string) {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return;
    updateLine(index, {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      taxRatePercentage: item.defaultTaxRateId || item.defaultTaxGroupId ? 0 : item.defaultTaxRatePercentage,
      // US-TAX-13: the item's inter-state tax outside my state.
      ...itemTaxFor(item, supplyType, { exportUnderLut }),
      // US-TAX-14: the item's HSN/SAC code, changeable on the line.
      hsnSac: item.hsnSac ?? "",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {lines.map((line, index) => (
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

              <div className="flex flex-1 flex-col gap-2">
                {line.type === "item" ? (
                  <ItemLineFields
                    line={line}
                    currency={currency}
                    catalogItems={catalogItems}
                    bundles={pickerBundles}
                    onPickBundle={(id) => insertBundle(index, id)}
                    taxOptions={taxOptions}
                    taxRates={taxRates}
                    taxGroups={taxGroups}
                    onApplyCatalogItem={(id) => applyCatalogItem(index, id)}
                    showHsn={showHsn}
                    onChange={(patch) => updateLine(index, patch)}
                  />
                ) : (
                  <NonItemLineFields line={line} onChange={(patch) => updateLine(index, patch)} />
                )}
                {flaggedKeys?.has(line.key) && <LineTaxWarning />}
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
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => addLine("item")}>
          <Plus size={14} /> Add item
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addLine("heading")}>
          <Plus size={14} /> Add heading
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addLine("text")}>
          <Plus size={14} /> Add text line
        </Button>
      </div>
    </div>
  );
}

function ItemLineFields({
  line,
  currency,
  catalogItems,
  bundles,
  onPickBundle,
  taxOptions,
  taxRates,
  taxGroups,
  onApplyCatalogItem,
  onChange,
  showHsn,
}: {
  line: EditableInvoiceLine;
  currency: string;
  catalogItems: CatalogItemOption[];
  bundles: PickerBundle[];
  onPickBundle: (id: string) => void;
  taxOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  onApplyCatalogItem: (id: string) => void;
  onChange: (patch: Partial<EditableInvoiceLine>) => void;
  showHsn: boolean;
}) {
  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
  const taxPercent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  const taxValue = line.taxRateId ? `rate:${line.taxRateId}` : line.taxGroupId ? `group:${line.taxGroupId}` : "";

  function applyTaxSelection(value: string) {
    if (value.startsWith("rate:")) {
      onChange({ taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
    } else if (value.startsWith("group:")) {
      onChange({ taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
    } else {
      onChange({ taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <LineItemPicker
        name={line.name}
        onNameChange={(name) => onChange({ name })}
        items={catalogItems}
        bundles={bundles}
        onPickBundle={onPickBundle}
        currency={currency}
        canSaveToCatalogue={false}
        saveToCatalogue={false}
        onPickItem={onApplyCatalogItem}
        onOneOff={() => onChange({ catalogItemId: null })}
      />
      <Input
        value={line.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description (optional)"
      />
      <div className="grid grid-cols-4 gap-2">
        <FieldLabel label="Qty">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={String(line.quantity)}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          />
        </FieldLabel>
        <FieldLabel label="Unit price">
          <MoneyInput value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        </FieldLabel>
        <FieldLabel label="Discount %">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={String(line.discountPercentage)}
            onChange={(e) => onChange({ discountPercentage: Number(e.target.value) || 0 })}
          />
        </FieldLabel>
        <FieldLabel label="Line total">
          <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 text-[14px] tabular-nums">
            {formatMoney(preview.total, currency)}
          </div>
        </FieldLabel>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <FieldLabel label="Tax">
          <Combobox options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder="No tax" />
        </FieldLabel>
        <label className="flex h-10 cursor-pointer items-center gap-2 pb-0.5">
          <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })} />
          <span className="text-[13px] text-on-surface">Price includes tax</span>
        </label>
      </div>
      {(showHsn || showsSupplyType(line.supplyClass, taxPercent)) && (
        <div className={showHsn ? "grid grid-cols-2 items-start gap-2" : "flex flex-col"}>
          {showHsn && <HsnSacField value={line.hsnSac} onChange={(hsnSac) => onChange({ hsnSac })} />}
          {showsSupplyType(line.supplyClass, taxPercent) && (
            <SupplyTypeField value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => onChange({ supplyClass })} />
          )}
        </div>
      )}
    </div>
  );
}

function NonItemLineFields({
  line,
  onChange,
}: {
  line: EditableInvoiceLine;
  onChange: (patch: Partial<EditableInvoiceLine>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Select value={line.type} onValueChange={(v) => onChange({ type: v as InvoiceLineType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heading">Heading</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={line.type === "heading" ? "Section heading" : "Free text"}
          className="flex-1 font-medium"
          required
        />
      </div>
      {line.type === "text" && (
        <Input
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Additional detail (optional)"
        />
      )}
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
