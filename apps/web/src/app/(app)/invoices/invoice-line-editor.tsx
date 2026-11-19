"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Combobox, Input, MoneyInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@spine/ui";
import { LineItemPicker, type PickerBundle } from "../../../components/line-item-picker";
import { bundleLines, useBundles } from "../../../lib/bundles";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { ArrowDown, ArrowUp, Heading, Plus, Trash2, Type } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { CatalogItemOption, InvoiceLineType, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { LineSheet, LineSheetField, LineSheetSummaryRow, PhoneLineCards, type PhoneLineCardData } from "../../../components/line-sheet";

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
  const t = useT();
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);

  useEffect(() => {
    apiClient
      .get<CatalogItemOption[]>("/catalog-items?picker=1")
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
      { value: "", label: t("invoices.lineEditor.noTax") },
      ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: `rate:${r.id}`, label: `${r.name} (${r.rate}%)` })),
      ...taxGroups
        .filter((g) => !g.archivedAt)
        .map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join("+")})` })),
    ],
    [taxRates, taxGroups, t],
  );

  /** A line with `patch` applied. US-TAX-11: the supply type follows the tax and the catalogue item. */
  function patchLine(line: EditableInvoiceLine, patch: Partial<EditableInvoiceLine>): EditableInvoiceLine {
    const merged = { ...line, ...patch };
    return withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
  }

  function updateLine(index: number, patch: Partial<EditableInvoiceLine>) {
    const next = lines.slice();
    next[index] = patchLine(next[index]!, patch);
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
    const patch = catalogPatch(catalogItemId);
    if (patch) updateLine(index, patch);
  }

  /** What picking a catalogue item fills in on a line. */
  function catalogPatch(catalogItemId: string): Partial<EditableInvoiceLine> | null {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return null;
    return {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      taxRatePercentage: item.defaultTaxRateId || item.defaultTaxGroupId ? 0 : item.defaultTaxRatePercentage,
      // US-TAX-13: the item's inter-state tax outside my state.
      ...itemTaxFor(item, supplyType, { exportUnderLut }),
      // US-TAX-14: the item's HSN/SAC code, changeable on the line.
      hsnSac: item.hsnSac ?? "",
    };
  }

  // US-OPS-59: on a phone the lines are cards; a line is edited in a sheet, kept with Done.
  const phone = useIsPhone();
  if (phone) {
    // A new schedule's one untouched blank line isn't shown as a card.
    const shown = lines.length === 1 && isUntouchedInvoiceLine(lines[0]!) ? [] : lines;
    const cards: PhoneLineCardData[] = shown.map((line) => {
      const preview = computeLinePreview(line, currency, taxRates, taxGroups);
      return {
        key: line.key,
        type: line.type,
        name: line.name,
        description: line.description,
        amount: line.type === "item" ? formatMoney(preview.total, currency) : undefined,
        detail:
          line.type === "item"
            ? [t("common.lineSheet.qtyTimesRate", { qty: line.quantity, rate: formatMoney(line.unitPriceAmount, currency) }), line.discountPercentage > 0 ? t("common.lineSheet.discountOff", { percent: line.discountPercentage }) : null].filter(Boolean).join(" · ")
            : undefined,
        tax: line.type === "item" ? invoiceLineTaxLabel(line, taxRates, taxGroups, t) : undefined,
        note: flaggedKeys?.has(line.key) ? <LineTaxWarning /> : undefined,
      };
    });
    return (
      <PhoneInvoiceLines
        lines={lines}
        shown={shown}
        cards={cards}
        onChange={onChange}
        currency={currency}
        catalogItems={catalogItems}
        bundles={pickerBundles}
        taxOptions={taxOptions}
        taxRates={taxRates}
        taxGroups={taxGroups}
        showHsn={showHsn}
        patchLine={patchLine}
        catalogPatch={catalogPatch}
        insertBundle={insertBundle}
      />
    );
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
                  aria-label={t("invoices.lineEditor.moveUp")}
                  disabled={index === 0}
                  onClick={() => moveLine(index, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t("invoices.lineEditor.moveDown")}
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
                aria-label={t("invoices.lineEditor.remove")}
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
          <Plus size={14} /> {t("invoices.lineEditor.addItem")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addLine("heading")}>
          <Plus size={14} /> {t("invoices.lineEditor.addHeading")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addLine("text")}>
          <Plus size={14} /> {t("invoices.lineEditor.addText")}
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
  const t = useT();
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
        placeholder={t("invoices.lineEditor.descriptionPlaceholder")}
      />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <FieldLabel label={t("invoices.lineEditor.qty")}>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={String(line.quantity)}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          />
        </FieldLabel>
        <FieldLabel label={t("invoices.lineEditor.unitPrice")}>
          <MoneyInput value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        </FieldLabel>
        <FieldLabel label={t("invoices.lineEditor.discount")}>
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
        <FieldLabel label={t("invoices.lineEditor.lineTotal")}>
          <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 text-[14px] tabular-nums">
            {formatMoney(preview.total, currency)}
          </div>
        </FieldLabel>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <FieldLabel label={t("invoices.lineEditor.tax")}>
          <Combobox options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder={t("invoices.lineEditor.noTax")} />
        </FieldLabel>
        <label className="flex h-10 cursor-pointer items-center gap-2 pb-0.5">
          <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })} />
          <span className="text-[13px] text-on-surface">{t("invoices.lineEditor.priceIncludesTax")}</span>
        </label>
      </div>
      {(showHsn || showsSupplyType(line.supplyClass, taxPercent)) && (
        <div className={showHsn ? "grid grid-cols-1 items-start gap-2 md:grid-cols-2" : "flex flex-col"}>
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
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Select value={line.type} onValueChange={(v) => onChange({ type: v as InvoiceLineType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heading">{t("invoices.lineEditor.heading")}</SelectItem>
              <SelectItem value="text">{t("invoices.lineEditor.text")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={line.type === "heading" ? t("invoices.lineEditor.headingPlaceholder") : t("invoices.lineEditor.textPlaceholder")}
          className="flex-1 font-medium"
          required
        />
      </div>
      {line.type === "text" && (
        <Input
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t("invoices.lineEditor.detailPlaceholder")}
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

/** A new schedule's one untouched blank line, which isn't shown as a card on a phone. */
function isUntouchedInvoiceLine(line: EditableInvoiceLine): boolean {
  return line.type === "item" && !line.catalogItemId && !line.name.trim() && !line.description.trim() && line.unitPriceAmount === 0n && line.quantity === 1;
}

/** A line's tax for its card and sheet: the rate's or group's name with its percentage ("GST 18%"). */
function invoiceLineTaxLabel(line: EditableInvoiceLine, taxRates: TaxRateOption[], taxGroups: TaxGroupOption[], t: ReturnType<typeof useT>): string | undefined {
  const percent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  if (!percent) return undefined;
  const name = line.taxRateId ? taxRates.find((r) => r.id === line.taxRateId)?.name : line.taxGroupId ? taxGroups.find((g) => g.id === line.taxGroupId)?.name : undefined;
  if (name) return name.includes("%") ? name : `${name} ${percent}%`;
  return t("invoices.linesTable.taxRate", { percent });
}

/**
 * US-OPS-59 (D-283) — the lines on a phone (a recurring invoice's): one card per line, Add item
 * (and Add heading, Add text) below, and one `LineSheet` editing a copy of the line — kept only
 * with Done — with Move up, Move down and Delete for a line that's already there.
 */
function PhoneInvoiceLines({
  lines,
  shown,
  cards,
  onChange,
  currency,
  catalogItems,
  bundles,
  taxOptions,
  taxRates,
  taxGroups,
  showHsn,
  patchLine,
  catalogPatch,
  insertBundle,
}: {
  lines: EditableInvoiceLine[];
  /** The lines shown as cards (all of them, unless the only one is an untouched blank). */
  shown: EditableInvoiceLine[];
  cards: PhoneLineCardData[];
  onChange: (lines: EditableInvoiceLine[]) => void;
  currency: string;
  catalogItems: CatalogItemOption[];
  bundles: PickerBundle[];
  taxOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  showHsn: boolean;
  patchLine: (line: EditableInvoiceLine, patch: Partial<EditableInvoiceLine>) => EditableInvoiceLine;
  catalogPatch: (catalogItemId: string) => Partial<EditableInvoiceLine> | null;
  insertBundle: (index: number, bundleId: string) => void;
}) {
  const t = useT();
  const [sheet, setSheet] = useState<{ index: number | null; draft: EditableInvoiceLine } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const editing = sheet?.index ?? null;
  const update = (patch: Partial<EditableInvoiceLine>) => setSheet((cur) => (cur ? { ...cur, draft: patchLine(cur.draft, patch) } : cur));
  const commit = (): EditableInvoiceLine[] => {
    if (!sheet) return lines;
    if (sheet.index === null) return [...shown, sheet.draft];
    const next = lines.slice();
    next[sheet.index] = sheet.draft;
    return next;
  };
  const move = (by: -1 | 1) => {
    if (!sheet || sheet.index === null) return;
    const next = commit();
    const to = sheet.index + by;
    const [moved] = next.splice(sheet.index, 1);
    next.splice(to, 0, moved!);
    onChange(next);
    setSheet({ index: to, draft: sheet.draft });
    setAnnouncement(t("common.lineSheet.moved", { position: to + 1, total: next.length }));
  };

  return (
    <>
      <PhoneLineCards
        lines={cards}
        testId="invoice-line-cards"
        onOpen={(index) => setSheet({ index, draft: shown[index]! })}
        onAdd={() => setSheet({ index: null, draft: blankLine("item") })}
        addLabel={t("invoices.lineEditor.addItem")}
        extraAdds={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSheet({ index: null, draft: blankLine("heading") })}>
              <Heading size={14} /> {t("invoices.lineEditor.addHeading")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSheet({ index: null, draft: blankLine("text") })}>
              <Type size={14} /> {t("invoices.lineEditor.addText")}
            </Button>
          </>
        }
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {sheet && (
        <LineSheet
          open
          title={editing === null ? t("common.lineSheet.newLine") : t("common.lineSheet.lineOf", { index: editing + 1, total: lines.length })}
          onCancel={() => setSheet(null)}
          onDone={() => {
            onChange(commit());
            setSheet(null);
          }}
          onMoveUp={editing === null ? undefined : editing > 0 ? () => move(-1) : null}
          onMoveDown={editing === null ? undefined : editing < lines.length - 1 ? () => move(1) : null}
          onDelete={
            editing === null
              ? undefined
              : () => {
                  onChange(lines.filter((_, i) => i !== editing));
                  setSheet(null);
                }
          }
          summary={sheet.draft.type === "item" ? <InvoiceLinePreviewSummary line={sheet.draft} currency={currency} taxRates={taxRates} taxGroups={taxGroups} /> : undefined}
        >
          <PhoneInvoiceLineFields
            line={sheet.draft}
            currency={currency}
            catalogItems={catalogItems}
            bundles={bundles}
            taxOptions={taxOptions}
            taxRates={taxRates}
            taxGroups={taxGroups}
            showHsn={showHsn}
            onChange={update}
            onApplyCatalogItem={(id) => {
              const patch = catalogPatch(id);
              if (patch) update(patch);
            }}
            onPickBundle={(id) => {
              // A bundle becomes its lines, where this line was (or after the others).
              insertBundle(editing ?? (shown.length ? lines.length : 0), id);
              setSheet(null);
            }}
          />
        </LineSheet>
      )}
    </>
  );
}

/** US-OPS-59: what the line in the sheet comes to — "4 × $650.00", its tax and the line amount. */
function InvoiceLinePreviewSummary({ line, currency, taxRates, taxGroups }: { line: EditableInvoiceLine; currency: string; taxRates: TaxRateOption[]; taxGroups: TaxGroupOption[] }) {
  const t = useT();
  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
  const tax = invoiceLineTaxLabel(line, taxRates, taxGroups, t);
  return (
    <>
      <LineSheetSummaryRow label={t("common.lineSheet.qtyTimesRate", { qty: line.quantity, rate: formatMoney(line.unitPriceAmount, currency) })} value={formatMoney(preview.subtotal, currency)} />
      {tax && <LineSheetSummaryRow label={tax} value={formatMoney(preview.tax, currency)} />}
      <LineSheetSummaryRow label={t("common.lineSheet.lineAmount")} value={formatMoney(preview.total, currency)} total />
    </>
  );
}

/** US-OPS-59: a line's fields in one column, for the line sheet on a phone. */
function PhoneInvoiceLineFields({
  line,
  currency,
  catalogItems,
  bundles,
  taxOptions,
  taxRates,
  taxGroups,
  showHsn,
  onChange,
  onApplyCatalogItem,
  onPickBundle,
}: {
  line: EditableInvoiceLine;
  currency: string;
  catalogItems: CatalogItemOption[];
  bundles: PickerBundle[];
  taxOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  showHsn: boolean;
  onChange: (patch: Partial<EditableInvoiceLine>) => void;
  onApplyCatalogItem: (id: string) => void;
  onPickBundle: (id: string) => void;
}) {
  const t = useT();
  if (line.type !== "item") {
    const label = line.type === "heading" ? t("invoices.lineEditor.heading") : t("invoices.lineEditor.text");
    return (
      <>
        <LineSheetField label={label} htmlFor="invoice-line-sheet-name">
          <Input id="invoice-line-sheet-name" value={line.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={line.type === "heading" ? t("invoices.lineEditor.headingPlaceholder") : t("invoices.lineEditor.textPlaceholder")} />
        </LineSheetField>
        {line.type === "text" && (
          <LineSheetField label={t("common.lineSheet.description")} htmlFor="invoice-line-sheet-detail">
            <Textarea id="invoice-line-sheet-detail" rows={2} value={line.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={t("invoices.lineEditor.detailPlaceholder")} />
          </LineSheetField>
        )}
      </>
    );
  }
  const taxPercent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  const taxValue = line.taxRateId ? `rate:${line.taxRateId}` : line.taxGroupId ? `group:${line.taxGroupId}` : "";
  const applyTaxSelection = (value: string) => {
    if (value.startsWith("rate:")) onChange({ taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
    else if (value.startsWith("group:")) onChange({ taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
    else onChange({ taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
  };
  return (
    <>
      <LineSheetField label={t("common.lineSheet.item")}>
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
      </LineSheetField>
      <LineSheetField label={t("common.lineSheet.description")} htmlFor="invoice-line-sheet-description">
        <Textarea id="invoice-line-sheet-description" rows={2} value={line.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={t("invoices.lineEditor.descriptionPlaceholder")} />
      </LineSheetField>
      <div className="grid grid-cols-2 gap-3">
        <LineSheetField label={t("common.lineSheet.quantity")} htmlFor="invoice-line-sheet-qty">
          <Input id="invoice-line-sheet-qty" type="number" inputMode="decimal" min={0} step="0.01" value={String(line.quantity)} onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })} className="tabular-nums" />
        </LineSheetField>
        <LineSheetField label={t("common.lineSheet.unitPrice")} htmlFor="invoice-line-sheet-price">
          <MoneyInput id="invoice-line-sheet-price" value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        </LineSheetField>
        <LineSheetField label={t("common.lineSheet.discount")} htmlFor="invoice-line-sheet-discount">
          <Input id="invoice-line-sheet-discount" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={String(line.discountPercentage)} onChange={(e) => onChange({ discountPercentage: Number(e.target.value) || 0 })} className="tabular-nums" />
        </LineSheetField>
      </div>
      <LineSheetField label={t("common.lineSheet.tax")}>
        <Combobox aria-label={t("invoices.lineEditor.tax")} options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder={t("invoices.lineEditor.noTax")} />
      </LineSheetField>
      <label className="flex items-center gap-2.5 text-[14px] text-on-surface">
        <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })} />
        {t("invoices.lineEditor.priceIncludesTax")}
      </label>
      {showHsn && <HsnSacField value={line.hsnSac} onChange={(hsnSac) => onChange({ hsnSac })} />}
      {showsSupplyType(line.supplyClass, taxPercent) && <SupplyTypeField value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => onChange({ supplyClass })} />}
    </>
  );
}
