"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Combobox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Kbd,
  MoneyInput,
  cn,
} from "@spine/ui";
import { LineItemPicker, type PickerBundle } from "../../../components/line-item-picker";
import { bundleLines, useBundles } from "../../../lib/bundles";
import { useCapability } from "../../../lib/capabilities-context";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { ArrowDown, ArrowUp, EllipsisVertical, GripVertical, Heading, Plus, Trash2, Type } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { CatalogItemOption, QuoteLineType, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";

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
  /** US-TAX-11 — why the line has no tax; null on heading and text lines. */
  supplyClass: SupplyClass | null;
  /** US-TAX-14 — the line's HSN/SAC code ("" when none). */
  hsnSac: string;
  /** US-CAT-06 — a one-off line to add to the catalogue when the quote is saved (it needs a price). Never sent to the server. */
  saveToCatalogue?: boolean;
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
    supplyClass: type === "item" ? "zero_rated" : null,
    hsnSac: "",
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
 * The multi-line editor. US-QUO-34 (D-214): one row per item — drag handle,
 * item, qty, rate, discount, tax and amount — with the description (and
 * HSN/SAC, supply type) under it; headings and text lines span the row.
 * Rows move by dragging the handle (only the handle is draggable, so text
 * in the fields can still be selected), from the row's menu, or with
 * Alt + ↑/↓; Enter in the last row's tax adds a row.
 */
export function QuoteLineEditor({
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

  const canSaveToCatalogue = useCapability("catalog.edit_own");
  // US-QUO-26: bundles in this quote's currency, offered above the items.
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

  function updateLine(index: number, patch: Partial<EditableQuoteLine>) {
    const next = lines.slice();
    const merged = { ...next[index]!, ...patch };
    // US-TAX-11: the supply type follows the tax and the catalogue item.
    next[index] = withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
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
      saveToCatalogue: false,
    });
  }

  // US-QUO-34: a new row starts with its Item field focused.
  const focusKey = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey.current) return;
    const row = document.querySelector(`[data-line-key="${focusKey.current}"]`);
    focusKey.current = null;
    (row?.querySelector("input") as HTMLInputElement | null)?.focus();
  }, [lines]);

  const [announcement, setAnnouncement] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; before: boolean } | null>(null);

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= lines.length || from === to) return;
    const next = lines.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
    setAnnouncement(`Moved to position ${to + 1} of ${lines.length}`);
  }

  function dropOn(targetKey: string, before: boolean) {
    if (!dragKey || dragKey === targetKey) return;
    const from = lines.findIndex((l) => l.key === dragKey);
    const without = lines.filter((l) => l.key !== dragKey);
    let to = without.findIndex((l) => l.key === targetKey);
    if (to === -1 || from === -1) return;
    if (!before) to += 1;
    const next = [...without.slice(0, to), lines[from]!, ...without.slice(to)];
    onChange(next);
    setAnnouncement(`Moved to position ${to + 1} of ${lines.length}`);
  }

  function addAndFocus(type: QuoteLineType) {
    const line = blankLine(type);
    focusKey.current = line.key;
    onChange([...lines, line]);
  }

  return (
    <div className="flex flex-col">
      <div className={cn(ROW_GRID, "hidden border-b border-border bg-surface-sunken px-3 py-2 text-[12px] font-medium text-on-surface-muted lg:grid")} aria-hidden>
        <span />
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Disc. %</span>
        <span>Tax</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <div className="flex flex-col" data-testid="quote-lines">
        {lines.map((line, index) => (
          <div
            key={line.key}
            data-line-key={line.key}
            aria-label={`Line ${index + 1} of ${lines.length}`}
            role="group"
            onDragOver={(e) => {
              if (!dragKey || dragKey === line.key) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setOver({ key: line.key, before: e.clientY < rect.top + rect.height / 2 });
            }}
            onDragLeave={() => setOver((o) => (o?.key === line.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(line.key, over?.key === line.key ? over.before : true);
              setDragKey(null);
              setOver(null);
            }}
            onKeyDown={(e) => {
              // Alt + ↑/↓ moves the row (US-QUO-34).
              if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              moveTo(index, index + (e.key === "ArrowUp" ? -1 : 1));
            }}
            className={cn(
              "relative border-b border-border px-3 py-2",
              dragKey === line.key && "opacity-40",
              over?.key === line.key && (over.before ? "shadow-[inset_0_2px_0_var(--color-primary)]" : "shadow-[inset_0_-2px_0_var(--color-primary)]"),
            )}
          >
            <LineRow
              line={line}
              index={index}
              count={lines.length}
              currency={currency}
              catalogItems={catalogItems}
              bundles={pickerBundles}
              canSaveToCatalogue={canSaveToCatalogue}
              taxOptions={taxOptions}
              taxRates={taxRates}
              taxGroups={taxGroups}
              showHsn={showHsn}
              onChange={(patch) => updateLine(index, patch)}
              onApplyCatalogItem={(id) => applyCatalogItem(index, id)}
              onPickBundle={(id) => insertBundle(index, id)}
              onMove={(to) => moveTo(index, to)}
              onRemove={() => removeLine(index)}
              onDragStart={() => setDragKey(line.key)}
              onDragEnd={() => {
                setDragKey(null);
                setOver(null);
              }}
              onEnterLast={index === lines.length - 1 ? () => addAndFocus("item") : undefined}
            />
            {flaggedKeys?.has(line.key) && <LineTaxWarning />}
          </div>
        ))}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => addAndFocus("item")}>
          <Plus size={14} /> Add item
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addAndFocus("heading")}>
          <Heading size={14} /> Add heading
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addAndFocus("text")}>
          <Type size={14} /> Add text line
        </Button>
        <span className="ml-auto hidden text-[12px] text-on-surface-muted lg:inline">
          Enter adds a row · <Kbd>Alt</Kbd> + <Kbd>↑</Kbd>/<Kbd>↓</Kbd> moves it
        </span>
      </div>
    </div>
  );
}

/** One grid for the header and every row (US-QUO-34): handle, item, qty, rate, discount, tax, amount, menu. Wraps under 1024 px. */
const ROW_GRID = "grid grid-cols-[24px_repeat(5,minmax(0,1fr))_32px] gap-2 lg:grid-cols-[24px_minmax(0,1fr)_76px_120px_76px_168px_112px_32px]";

function LineRow({
  line,
  index,
  count,
  currency,
  catalogItems,
  bundles,
  canSaveToCatalogue,
  taxOptions,
  taxRates,
  taxGroups,
  showHsn,
  onChange,
  onApplyCatalogItem,
  onPickBundle,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
  onEnterLast,
}: {
  line: EditableQuoteLine;
  index: number;
  count: number;
  currency: string;
  catalogItems: CatalogItemOption[];
  bundles: PickerBundle[];
  canSaveToCatalogue: boolean;
  taxOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  showHsn: boolean;
  onChange: (patch: Partial<EditableQuoteLine>) => void;
  onApplyCatalogItem: (id: string) => void;
  onPickBundle: (id: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEnterLast?: () => void;
}) {
  const [details, setDetails] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const handle = (
    <span
      draggable
      role="button"
      tabIndex={-1}
      aria-label={`Drag line ${index + 1}`}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", line.key);
        const row = rowRef.current?.closest("[data-line-key]");
        if (row) e.dataTransfer.setDragImage(row, 16, 16);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="flex h-9 cursor-grab items-center justify-center text-on-surface-muted active:cursor-grabbing"
    >
      <GripVertical size={15} aria-hidden />
    </span>
  );
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for line ${index + 1}`} className="flex h-9 w-8 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
          <EllipsisVertical size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
          <ArrowUp size={14} aria-hidden /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
          <ArrowDown size={14} aria-hidden /> Move down
        </DropdownMenuItem>
        {line.type === "item" && (
          <DropdownMenuCheckboxItem checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })}>
            Price includes tax
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onRemove}>
          <Trash2 size={14} aria-hidden /> Remove line
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (line.type !== "item") {
    return (
      <div ref={rowRef} className={ROW_GRID}>
        {handle}
        <Input
          aria-label={line.type === "heading" ? "Heading" : "Text line"}
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={line.type === "heading" ? "Section heading" : "Text for the customer"}
          className={cn("col-span-5 lg:col-span-6", line.type === "heading" ? "font-semibold" : "text-on-surface-muted")}
          required
        />
        {menu}
      </div>
    );
  }

  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
  const taxPercent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  const taxValue = line.taxRateId ? `rate:${line.taxRateId}` : line.taxGroupId ? `group:${line.taxGroupId}` : "";
  const showSupply = showsSupplyType(line.supplyClass, taxPercent);
  const showDetails = details || Boolean(line.description) || showHsn || showSupply || line.isTaxInclusive;
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnterLast) {
      e.preventDefault();
      onEnterLast();
    }
  };

  function applyTaxSelection(value: string) {
    if (value.startsWith("rate:")) onChange({ taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
    else if (value.startsWith("group:")) onChange({ taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
    else onChange({ taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
  }

  return (
    <div ref={rowRef} className="flex flex-col gap-1.5">
      <div className={cn(ROW_GRID, "items-center")}>
        {handle}
        <div className="col-span-5 min-w-0 lg:col-span-1">
          <LineItemPicker
            name={line.name}
            onNameChange={(name) => onChange({ name })}
            items={catalogItems}
            bundles={bundles}
            onPickBundle={onPickBundle}
            currency={currency}
            canSaveToCatalogue={canSaveToCatalogue}
            saveToCatalogue={!!line.saveToCatalogue}
            onPickItem={onApplyCatalogItem}
            onOneOff={(save) => onChange({ catalogItemId: null, saveToCatalogue: save })}
          />
        </div>
        <Input
          aria-label="Quantity"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={String(line.quantity)}
          onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          className="col-start-2 text-right tabular-nums lg:col-start-auto"
        />
        <MoneyInput aria-label="Unit price" value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        <Input
          aria-label="Discount %"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={String(line.discountPercentage)}
          onChange={(e) => onChange({ discountPercentage: Number(e.target.value) || 0 })}
          className="text-right tabular-nums"
        />
        <div onKeyDown={onEnter}>
          <Combobox aria-label="Tax" options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder="No tax" />
        </div>
        <span className="text-right text-[13.5px] font-medium tabular-nums text-on-surface" data-testid="line-amount">
          {formatMoney(preview.total, currency)}
        </span>
        <span className="row-start-1 col-start-7 lg:row-start-auto lg:col-start-auto">{menu}</span>
      </div>
      {line.saveToCatalogue && (
        <p className="pl-8 text-[12px] text-on-surface-muted">
          Added to the catalogue when you save the quote{line.unitPriceAmount > 0n ? "." : " — give it a price first."}{" "}
          <button type="button" className="text-primary hover:underline" onClick={() => onChange({ saveToCatalogue: false })}>
            Don&apos;t add it
          </button>
        </p>
      )}
      {showDetails ? (
        // US-QUO-34: the details row shares the line's grid — description under Item to Disc. %, HSN/SAC under Tax, supply type beside it.
        <div className={cn(ROW_GRID, "items-start")}>
          <Input
            aria-label="Description"
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (optional)"
            className="col-[2/span_5] h-8 text-[13px] lg:col-[2/span_4]"
          />
          {showHsn && (
            <div className="col-[2/span_2] lg:col-[6/span_1]">
              <HsnSacField compact value={line.hsnSac} onChange={(hsnSac) => onChange({ hsnSac })} />
            </div>
          )}
          {showSupply && (
            <div className={showHsn ? "col-[4/span_2] lg:col-[7/span_2]" : "col-[2/span_2] lg:col-[6/span_1]"}>
              <SupplyTypeField compact value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => onChange({ supplyClass })} />
            </div>
          )}
        </div>
      ) : (
        <div className={ROW_GRID}>
          <button type="button" onClick={() => setDetails(true)} className="col-[2/span_5] flex w-fit items-center gap-1 text-[12.5px] font-medium text-primary hover:underline lg:col-[2/span_4]">
            <Plus size={13} aria-hidden /> Add description
          </button>
        </div>
      )}
    </div>
  );
}
