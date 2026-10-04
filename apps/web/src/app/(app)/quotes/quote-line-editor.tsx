"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Combobox, Input, MoneyInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { computeDocumentLine, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { CatalogItemOption, QuoteLineType, TaxGroupOption, TaxRateOption } from "./types";

/** Client-side line shape while editing — money fields as `bigint` (never a float), matching MoneyInput's own contract. Not the same as the API's QuoteLine (which serializes bigints as strings and includes server-computed fields this component doesn't need pre-save). */
export interface EditableQuoteLine {
  key: string; // stable React key across reorders — not sent to the server
  type: QuoteLineType;
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
}

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `line-${Date.now()}-${keySeq}`;
}

export function blankLine(type: QuoteLineType = "item"): EditableQuoteLine {
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
  };
}

/** Resolves a line's chosen tax rate/group into `computeLineTax`'s input shape, given the full rate/group lists — mirrors TaxResolverService.resolve (apps/api) client-side for instant preview. Falls back to the legacy flat percentage when neither is set. */
function resolveLineTaxRates(
  line: EditableQuoteLine,
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
 * will store, without duplicating tax math. This is purely for instant
 * client-side feedback (CLAUDE.md/task brief); the server remains the sole
 * source of truth and recomputes everything from scratch on every save.
 */
export function computeLinePreview(
  line: EditableQuoteLine,
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
 * buttons (no drag-and-drop library pulled in for Stage 1 — a bounded list
 * of a handful of lines doesn't need it, and buttons are fully keyboard/
 * screen-reader operable without any extra work, unlike most drag
 * implementations).
 */
export function QuoteLineEditor({
  lines,
  onChange,
  currency,
}: {
  lines: EditableQuoteLine[];
  onChange: (lines: EditableQuoteLine[]) => void;
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

  const catalogOptions = useMemo(
    () => catalogItems.filter((i) => !i.archivedAt).map((i) => ({ value: i.id, label: i.name })),
    [catalogItems],
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

  function updateLine(index: number, patch: Partial<EditableQuoteLine>) {
    const next = lines.slice();
    next[index] = { ...next[index]!, ...patch };
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

  function addLine(type: QuoteLineType) {
    onChange([...lines, blankLine(type)]);
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
      taxRateId: item.defaultTaxRateId,
      taxGroupId: item.defaultTaxGroupId,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <div key={line.key} className="rounded-lg border border-border p-3">
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

              <div className="flex-1">
                {line.type === "item" ? (
                  <ItemLineFields
                    line={line}
                    currency={currency}
                    catalogOptions={catalogOptions}
                    taxOptions={taxOptions}
                    taxRates={taxRates}
                    taxGroups={taxGroups}
                    onApplyCatalogItem={(id) => applyCatalogItem(index, id)}
                    onChange={(patch) => updateLine(index, patch)}
                  />
                ) : (
                  <NonItemLineFields line={line} onChange={(patch) => updateLine(index, patch)} />
                )}
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
  catalogOptions,
  taxOptions,
  taxRates,
  taxGroups,
  onApplyCatalogItem,
  onChange,
}: {
  line: EditableQuoteLine;
  currency: string;
  catalogOptions: { value: string; label: string }[];
  taxOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  onApplyCatalogItem: (id: string) => void;
  onChange: (patch: Partial<EditableQuoteLine>) => void;
}) {
  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
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
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={line.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Item name" required />
        <div className="w-48">
          <Combobox
            options={catalogOptions}
            value={line.catalogItemId ?? undefined}
            onValueChange={onApplyCatalogItem}
            placeholder="Prefill from catalogue…"
          />
        </div>
      </div>
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
          <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 font-mono text-[14px] tabular-nums">
            {toDecimalString({ amount: preview.total, currency })}
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
    </div>
  );
}

function NonItemLineFields({
  line,
  onChange,
}: {
  line: EditableQuoteLine;
  onChange: (patch: Partial<EditableQuoteLine>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Select value={line.type} onValueChange={(v) => onChange({ type: v as QuoteLineType })}>
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
