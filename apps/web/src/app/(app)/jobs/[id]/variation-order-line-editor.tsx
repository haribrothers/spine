"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Combobox, Input, MoneyInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { computeLineTax, money } from "@spine/shared";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";

type VariationLineType = "item" | "heading" | "text";

interface CatalogItemOption {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRatePercentage: number;
  archivedAt: string | null;
}

/**
 * Line editor for a variation order's wrapped quote (S-04.9 — a variation
 * order IS a supplementary quote, see createVariationOrderSchema's own
 * comment). Structurally identical to invoices/invoice-line-editor.tsx and
 * quotes/quote-line-editor.tsx — duplicated rather than shared, matching
 * those files' own precedent on why each document-line surface stays
 * independently owned.
 */
export interface EditableVariationLine {
  key: string;
  type: VariationLineType;
  catalogItemId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPriceAmount: bigint;
  discountPercentage: number;
  taxRatePercentage: number;
}

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `vo-line-${Date.now()}-${keySeq}`;
}

export function blankVariationLine(type: VariationLineType = "item"): EditableVariationLine {
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
  };
}

export function computeVariationLinePreview(line: EditableVariationLine, currency: string) {
  if (line.type !== "item") {
    return { subtotal: 0n, tax: 0n, total: 0n };
  }
  const gross = BigInt(Math.round(line.quantity * Number(line.unitPriceAmount)));
  const discount = BigInt(Math.round(Number(gross) * (line.discountPercentage / 100)));
  const net = gross - discount;
  const taxResult = computeLineTax(
    money(net, currency),
    line.taxRatePercentage > 0 ? [{ id: "line", name: "Tax", rate: line.taxRatePercentage / 100, isCompound: false }] : [],
    false,
  );
  return { subtotal: net, tax: taxResult.taxAmount.amount, total: taxResult.total.amount };
}

export function VariationOrderLineEditor({
  lines,
  onChange,
  currency,
}: {
  lines: EditableVariationLine[];
  onChange: (lines: EditableVariationLine[]) => void;
  currency: string;
}) {
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);

  useEffect(() => {
    apiClient
      .get<CatalogItemOption[]>("/catalog-items")
      .then(setCatalogItems)
      .catch(() => {});
  }, []);

  const catalogOptions = useMemo(
    () => catalogItems.filter((i) => !i.archivedAt).map((i) => ({ value: i.id, label: i.name })),
    [catalogItems],
  );

  function updateLine(index: number, patch: Partial<EditableVariationLine>) {
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

  function addLine(type: VariationLineType) {
    onChange([...lines, blankVariationLine(type)]);
  }

  function applyCatalogItem(index: number, catalogItemId: string) {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return;
    updateLine(index, {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      taxRatePercentage: item.defaultTaxRatePercentage,
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
  onApplyCatalogItem,
  onChange,
}: {
  line: EditableVariationLine;
  currency: string;
  catalogOptions: { value: string; label: string }[];
  onApplyCatalogItem: (id: string) => void;
  onChange: (patch: Partial<EditableVariationLine>) => void;
}) {
  const preview = computeVariationLinePreview(line, currency);

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
      <div className="grid grid-cols-5 gap-2">
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
        <FieldLabel label="Tax %">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={String(line.taxRatePercentage)}
            onChange={(e) => onChange({ taxRatePercentage: Number(e.target.value) || 0 })}
          />
        </FieldLabel>
        <FieldLabel label="Line total">
          <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 font-mono text-[14px] tabular-nums">
            {toDecimalString({ amount: preview.total, currency })}
          </div>
        </FieldLabel>
      </div>
    </div>
  );
}

function NonItemLineFields({
  line,
  onChange,
}: {
  line: EditableVariationLine;
  onChange: (patch: Partial<EditableVariationLine>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Select value={line.type} onValueChange={(v) => onChange({ type: v as VariationLineType })}>
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
