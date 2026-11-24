"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
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
  Textarea,
  cn,
} from "@spine/ui";
import { LineItemPicker, type PickerBundle } from "../../../components/line-item-picker";
import { bundleLines, useBundles } from "../../../lib/bundles";
import { useCapability } from "../../../lib/capabilities-context";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { EllipsisVertical, GripVertical, Heading, Plus, Type } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { CatalogItemOption, QuoteLineType, TaxGroupOption, TaxRateOption } from "./types";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { formatMoney } from "../../../lib/money";
import type { AiQuoteLine } from "@spine/shared";
import { AiSuggestedTag } from "../../../components/ai-suggested-tag";
import { aiFeatureShown, useAiStatus } from "../../../lib/use-ai-status";
import { QuoteAiLinesPanel } from "./quote-ai-lines-panel";
import { isUntouchedBlank, rowsFromAiLines } from "./quote-ai-lines";
import { useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { LineSheet, LineSheetField, LineSheetSummaryRow, PhoneLineCards, type PhoneLineCardData } from "../../../components/line-sheet";

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
  /** US-AI-13 — "Add a price — …" on a line AI proposed without one, until it has a price. Never sent to the server. */
  aiPriceNote?: string;
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
 * client-side feedback; the server remains the sole
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
 * Alt + ↑/↓; Enter in the last row's tax adds a row. US-AI-13 — "Draft
 * lines with AI" beside "Add item"; the rows it adds read "Suggested by AI"
 * until changed (`aiKeys`).
 */
export function QuoteLineEditor({
  lines,
  onChange,
  currency,
  supplyType = null,
  exportUnderLut = false,
  flaggedKeys,
  showHsn = false,
  aiKeys,
  aiDraft,
}: {
  /** US-AI-13 — rows AI added that haven't been changed. */
  aiKeys?: Set<string>;
  /** US-AI-13 — where "Draft lines with AI" adds to: the draft quote, and the keys of the rows it added. */
  aiDraft?: { quoteId?: string; onAdded: (keys: string[]) => void };
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

  const canSaveToCatalogue = useCapability("catalog.edit_own");
  // US-QUO-26: bundles in this quote's currency, offered above the items.
  const { bundles, pickerBundles } = useBundles(currency);

  const taxOptions = useMemo(
    () => [
      { value: "", label: t("quotes.lineEditor.noTax") },
      ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: `rate:${r.id}`, label: `${r.name} (${r.rate}%)` })),
      ...taxGroups
        .filter((g) => !g.archivedAt)
        .map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join("+")})` })),
    ],
    [taxRates, taxGroups, t],
  );

  /** A line with `patch` applied. US-TAX-11: the supply type follows the tax and the catalogue item. */
  function patchLine(line: EditableQuoteLine, patch: Partial<EditableQuoteLine>): EditableQuoteLine {
    const merged = { ...line, ...patch };
    return withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
  }

  function updateLine(index: number, patch: Partial<EditableQuoteLine>) {
    const next = lines.slice();
    next[index] = patchLine(next[index]!, patch);
    onChange(next);
  }

  // US-AI-13: drafted lines become rows exactly as if picked by hand, after the last line.
  const aiStatus = useAiStatus();
  const aiShown = Boolean(aiDraft) && aiFeatureShown(aiStatus, "draftQuoteLines");
  function addAiLines(proposed: AiQuoteLine[]) {
    const rows = rowsFromAiLines(proposed, {
      catalogItems,
      bundles,
      currency,
      supplyType,
      exportUnderLut,
      // As picking the item by hand: the item and its tax are what changed, so the supply type follows them.
      withSupply: (line, item) =>
        withSupplyClass(line, { catalogItemId: line.catalogItemId, taxRateId: line.taxRateId, taxGroupId: line.taxGroupId }, lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups)), item, taxRates),
    });
    if (!rows.length) return;
    const base = lines.length === 1 && isUntouchedBlank(lines[0]!) ? [] : lines;
    onChange([...base, ...rows]);
    aiDraft?.onAdded(rows.map((r) => r.key));
    setAnnouncement(t("quotes.lineEditor.linesAdded", { count: rows.length }));
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
    const patch = catalogPatch(catalogItemId);
    if (patch) updateLine(index, patch);
  }

  /** What picking a catalogue item fills in on a line. */
  function catalogPatch(catalogItemId: string): Partial<EditableQuoteLine> | null {
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
      saveToCatalogue: false,
    };
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
    setAnnouncement(t("quotes.lineEditor.movedTo", { position: to + 1, total: lines.length }));
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
    setAnnouncement(t("quotes.lineEditor.movedTo", { position: to + 1, total: lines.length }));
  }

  function addAndFocus(type: QuoteLineType) {
    const line = blankLine(type);
    focusKey.current = line.key;
    onChange([...lines, line]);
  }

  // US-OPS-59: on a phone the lines are cards; a line is edited in a sheet, kept with Done.
  const phone = useIsPhone();
  const [sheet, setSheet] = useState<{ index: number | null; draft: EditableQuoteLine } | null>(null);
  if (phone) {
    // A new quote's one untouched blank line isn't shown as a card.
    const shown = lines.length === 1 && isUntouchedBlank(lines[0]!) ? [] : lines;
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
        tax: line.type === "item" ? lineTaxLabel(line, taxRates, taxGroups, t) : undefined,
        note: (
          <>
            {flaggedKeys?.has(line.key) && <LineTaxWarning />}
            {aiKeys?.has(line.key) && <AiSuggestedTag className="mt-1" />}
          </>
        ),
      };
    });
    const editing = sheet?.index ?? null;
    const commit = (): EditableQuoteLine[] => {
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
      setAnnouncement(t("quotes.lineEditor.movedTo", { position: to + 1, total: next.length }));
    };
    return (
      <>
        <PhoneLineCards
          lines={cards}
          testId="quote-line-cards"
          onOpen={(index) => setSheet({ index, draft: shown[index]! })}
          onAdd={() => setSheet({ index: null, draft: blankLine("item") })}
          addLabel={t("quotes.lineEditor.addItem")}
          extraAdds={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSheet({ index: null, draft: blankLine("heading") })}>
                <Heading size={14} /> {t("quotes.lineEditor.addHeading")}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSheet({ index: null, draft: blankLine("text") })}>
                <Type size={14} /> {t("quotes.lineEditor.addText")}
              </Button>
              {aiShown && <QuoteAiLinesPanel currency={currency} quoteId={aiDraft?.quoteId} catalogItems={catalogItems} bundles={bundles} pausedUntil={aiStatus?.pausedUntil ?? null} onAdd={addAiLines} />}
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
            summary={sheet.draft.type === "item" ? <LinePreviewSummary line={sheet.draft} currency={currency} taxRates={taxRates} taxGroups={taxGroups} /> : undefined}
          >
            <PhoneLineFields
              line={sheet.draft}
              currency={currency}
              catalogItems={catalogItems}
              bundles={pickerBundles}
              canSaveToCatalogue={canSaveToCatalogue}
              taxOptions={taxOptions}
              taxRates={taxRates}
              taxGroups={taxGroups}
              showHsn={showHsn}
              onChange={(patch) => setSheet((cur) => (cur ? { ...cur, draft: patchLine(cur.draft, patch) } : cur))}
              onApplyCatalogItem={(id) => {
                const patch = catalogPatch(id);
                if (patch) setSheet((cur) => (cur ? { ...cur, draft: patchLine(cur.draft, patch) } : cur));
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

  return (
    <div className="flex flex-col">
      <div className={cn(ROW_GRID, "hidden border-b border-border bg-surface-sunken px-3 py-2 text-[12px] font-medium text-on-surface-muted lg:grid")} aria-hidden>
        <span />
        <span>{t("quotes.lineEditor.item")}</span>
        <span className="text-right">{t("quotes.lineEditor.qty")}</span>
        <span className="text-right">{t("quotes.lineEditor.rate")}</span>
        <span className="text-right">{t("quotes.lineEditor.discount")}</span>
        <span>{t("quotes.lineEditor.tax")}</span>
        <span className="text-right">{t("quotes.lineEditor.amount")}</span>
        <span />
      </div>
      <div className="flex flex-col" data-testid="quote-lines">
        {lines.map((line, index) => (
          <div
            key={line.key}
            data-line-key={line.key}
            aria-label={t("quotes.lineEditor.lineOf", { index: index + 1, total: lines.length })}
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
              aiKeys?.has(line.key) && "bg-info-bg/40",
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
              suggested={aiKeys?.has(line.key) ?? false}
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
          <Plus size={14} /> {t("quotes.lineEditor.addItem")}
        </Button>
        {aiShown && <QuoteAiLinesPanel currency={currency} quoteId={aiDraft?.quoteId} catalogItems={catalogItems} bundles={bundles} pausedUntil={aiStatus?.pausedUntil ?? null} onAdd={addAiLines} />}
        <Button type="button" variant="secondary" size="sm" onClick={() => addAndFocus("heading")}>
          <Heading size={14} /> {t("quotes.lineEditor.addHeading")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => addAndFocus("text")}>
          <Type size={14} /> {t("quotes.lineEditor.addText")}
        </Button>
        <span className="ml-auto hidden text-[12px] text-on-surface-muted lg:inline">
          {t("quotes.lineEditor.shortcutsEnter")}
          {/* eslint-disable-next-line i18next/no-literal-string -- key names and symbols */}
          <Kbd>Alt</Kbd> + <Kbd>↑</Kbd>/<Kbd>↓</Kbd>
          {t("quotes.lineEditor.shortcutsMoves")}
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
  suggested,
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
  suggested: boolean;
  onChange: (patch: Partial<EditableQuoteLine>) => void;
  onApplyCatalogItem: (id: string) => void;
  onPickBundle: (id: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEnterLast?: () => void;
}) {
  const t = useT();
  const [details, setDetails] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const handle = (
    <span
      draggable
      role="button"
      tabIndex={-1}
      aria-label={t("quotes.lineEditor.dragLine", { index: index + 1 })}
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
        <button type="button" aria-label={t("quotes.lineEditor.lineActions", { index: index + 1 })} className="flex h-9 w-8 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
          <EllipsisVertical size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
          <MENU_ICONS.moveUp aria-hidden />
          {t("quotes.lineEditor.moveUp")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
          <MENU_ICONS.moveDown aria-hidden />
          {t("quotes.lineEditor.moveDown")}
        </DropdownMenuItem>
        {line.type === "item" && (
          <DropdownMenuCheckboxItem checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })}>
            {t("quotes.lineEditor.priceIncludesTax")}
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onRemove}>
          <MENU_ICONS.delete aria-hidden />
          {t("quotes.lineEditor.removeLine")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (line.type !== "item") {
    return (
      <div ref={rowRef} className={ROW_GRID}>
        {handle}
        <Input
          aria-label={line.type === "heading" ? t("quotes.lineEditor.heading") : t("quotes.lineEditor.textLine")}
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={line.type === "heading" ? t("quotes.lineEditor.headingPlaceholder") : t("quotes.lineEditor.textPlaceholder")}
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
          aria-label={t("quotes.lineEditor.quantity")}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={String(line.quantity)}
          onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          className="col-start-2 text-right tabular-nums lg:col-start-auto"
        />
        <MoneyInput aria-label={t("quotes.lineEditor.unitPrice")} value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        <Input
          aria-label={t("quotes.lineEditor.discountLabel")}
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
          <Combobox aria-label={t("quotes.lineEditor.tax")} options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder={t("quotes.lineEditor.noTax")} />
        </div>
        <span className="text-right text-[13.5px] font-medium tabular-nums text-on-surface" data-testid="line-amount">
          {formatMoney(preview.total, currency)}
        </span>
        <span className="row-start-1 col-start-7 lg:row-start-auto lg:col-start-auto">{menu}</span>
      </div>
      {/* US-AI-13: an AI line without a price says so until it has one; the tag goes once the line is changed. */}
      {((line.aiPriceNote && line.unitPriceAmount === 0n) || suggested) && (
        <div className="flex items-center gap-3 pl-8">
          {line.aiPriceNote && line.unitPriceAmount === 0n && (
            <p className="text-[12.5px] font-medium text-due-soon" data-testid="ai-price-note">
              {line.aiPriceNote}
            </p>
          )}
          {suggested && <AiSuggestedTag className="ml-auto" />}
        </div>
      )}
      {line.saveToCatalogue && (
        <p className="pl-8 text-[12px] text-on-surface-muted">
          {line.unitPriceAmount > 0n ? t("quotes.lineEditor.addedToCatalogue") : t("quotes.lineEditor.addedToCatalogueNeedsPrice")}{" "}
          <button type="button" className="text-primary hover:underline" onClick={() => onChange({ saveToCatalogue: false })}>
            {t("quotes.lineEditor.dontAdd")}
          </button>
        </p>
      )}
      {showDetails ? (
        // US-QUO-34: the details row shares the line's grid — description under Item to Disc. %, HSN/SAC under Tax, supply type beside it.
        <div className={cn(ROW_GRID, "items-start")}>
          <Input
            aria-label={t("quotes.lineEditor.description")}
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t("quotes.lineEditor.descriptionPlaceholder")}
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
            <Plus size={13} aria-hidden /> {t("quotes.lineEditor.addDescription")}
          </button>
        </div>
      )}
    </div>
  );
}

/** A line's tax for its card: the rate's or group's name with its percentage ("GST 18%"). */
function lineTaxLabel(line: EditableQuoteLine, taxRates: TaxRateOption[], taxGroups: TaxGroupOption[], t: ReturnType<typeof useT>): string | undefined {
  const rates = resolveLineTaxRates(line, taxRates, taxGroups);
  const percent = lineTaxPercent(rates);
  if (!percent) return undefined;
  const name = line.taxRateId ? taxRates.find((r) => r.id === line.taxRateId)?.name : line.taxGroupId ? taxGroups.find((g) => g.id === line.taxGroupId)?.name : undefined;
  if (name) return name.includes("%") ? name : `${name} ${percent}%`;
  return t("invoices.linesTable.taxRate", { percent });
}

/** US-OPS-59: what the line in the sheet comes to — "4 × $650.00", its tax and the line amount. */
function LinePreviewSummary({ line, currency, taxRates, taxGroups }: { line: EditableQuoteLine; currency: string; taxRates: TaxRateOption[]; taxGroups: TaxGroupOption[] }) {
  const t = useT();
  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
  const tax = lineTaxLabel(line, taxRates, taxGroups, t);
  return (
    <>
      <LineSheetSummaryRow label={t("common.lineSheet.qtyTimesRate", { qty: line.quantity, rate: formatMoney(line.unitPriceAmount, currency) })} value={formatMoney(preview.subtotal, currency)} />
      {tax && <LineSheetSummaryRow label={tax} value={formatMoney(preview.tax, currency)} />}
      <LineSheetSummaryRow label={t("common.lineSheet.lineAmount")} value={formatMoney(preview.total, currency)} total />
    </>
  );
}

/** US-OPS-59: a line's fields in one column, for the line sheet on a phone. */
function PhoneLineFields({
  line,
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
}: {
  line: EditableQuoteLine;
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
}) {
  const t = useT();
  if (line.type !== "item") {
    const label = line.type === "heading" ? t("quotes.lineEditor.heading") : t("quotes.lineEditor.textLine");
    return (
      <LineSheetField label={label} htmlFor="line-sheet-name">
        <Input id="line-sheet-name" value={line.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={line.type === "heading" ? t("quotes.lineEditor.headingPlaceholder") : t("quotes.lineEditor.textPlaceholder")} />
      </LineSheetField>
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
          canSaveToCatalogue={canSaveToCatalogue}
          saveToCatalogue={!!line.saveToCatalogue}
          onPickItem={onApplyCatalogItem}
          onOneOff={(save) => onChange({ catalogItemId: null, saveToCatalogue: save })}
        />
        {line.saveToCatalogue && (
          <p className="text-[12px] text-on-surface-muted">
            {line.unitPriceAmount > 0n ? t("quotes.lineEditor.addedToCatalogue") : t("quotes.lineEditor.addedToCatalogueNeedsPrice")}{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => onChange({ saveToCatalogue: false })}>
              {t("quotes.lineEditor.dontAdd")}
            </button>
          </p>
        )}
      </LineSheetField>
      <LineSheetField label={t("common.lineSheet.description")} htmlFor="line-sheet-description">
        <Textarea id="line-sheet-description" rows={2} value={line.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={t("quotes.lineEditor.descriptionPlaceholder")} />
      </LineSheetField>
      <div className="grid grid-cols-2 gap-3">
        <LineSheetField label={t("common.lineSheet.quantity")} htmlFor="line-sheet-qty">
          <Input id="line-sheet-qty" type="number" inputMode="decimal" min={0} step="0.01" value={String(line.quantity)} onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })} className="tabular-nums" />
        </LineSheetField>
        <LineSheetField label={t("common.lineSheet.unitPrice")} htmlFor="line-sheet-price">
          <MoneyInput id="line-sheet-price" value={line.unitPriceAmount} onValueChange={(v) => onChange({ unitPriceAmount: v })} currency={currency} />
        </LineSheetField>
        <LineSheetField label={t("common.lineSheet.discount")} htmlFor="line-sheet-discount">
          <Input id="line-sheet-discount" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={String(line.discountPercentage)} onChange={(e) => onChange({ discountPercentage: Number(e.target.value) || 0 })} className="tabular-nums" />
        </LineSheetField>
      </div>
      <LineSheetField label={t("common.lineSheet.tax")}>
        <Combobox aria-label={t("quotes.lineEditor.tax")} options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder={t("quotes.lineEditor.noTax")} />
      </LineSheetField>
      <label className="flex items-center gap-2.5 text-[14px] text-on-surface">
        <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })} />
        {t("quotes.lineEditor.priceIncludesTax")}
      </label>
      {showHsn && <HsnSacField value={line.hsnSac} onChange={(hsnSac) => onChange({ hsnSac })} />}
      {showsSupplyType(line.supplyClass, taxPercent) && <SupplyTypeField value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => onChange({ supplyClass })} />}
    </>
  );
}
