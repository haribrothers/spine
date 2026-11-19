"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Combobox, Input, MoneyInput, Textarea } from "@spine/ui";
import { computeDocumentLine, itemTaxFor, type SupplyClass, type SupplyType, type TaxRate as ComputeTaxRate } from "@spine/shared";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { AccountOption, CatalogItemOption, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { LineItemPicker } from "../../../components/line-item-picker";
import { AiSuggestedTag } from "../../../components/ai-suggested-tag";
import { LineSheet, LineSheetField, LineSheetSummaryRow, PhoneLineCards, type PhoneLineCardData } from "../../../components/line-sheet";

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
  /** US-TAX-14 — the line's HSN/SAC code ("" when none). */
  hsnSac: string;
}

let keySeq = 0;
export function newKey() {
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
    hsnSac: "",
  };
}

/** Resolves a line's chosen tax rate/group into `computeLineTax`'s input shape — mirrors invoices/invoice-line-editor.tsx's identical helper. */
export function resolveLineTaxRates(
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
  lines: EditableVendorBillLine[];
  onChange: (lines: EditableVendorBillLine[]) => void;
  currency: string;
}) {
  const t = useT();
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);

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
      { value: "", label: t("vendorBills.lineEditor.noTax") },
      ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: `rate:${r.id}`, label: `${r.name} (${r.rate}%)` })),
      ...taxGroups
        .filter((g) => !g.archivedAt)
        .map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join("+")})` })),
    ],
    [taxRates, taxGroups],
  );

  /** A line with `patch` applied. US-TAX-11: the supply type follows the tax and the catalogue item. */
  function patchLine(line: EditableVendorBillLine, patch: Partial<EditableVendorBillLine>): EditableVendorBillLine {
    const merged = { ...line, ...patch };
    return withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
  }

  function updateLine(index: number, patch: Partial<EditableVendorBillLine>) {
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

  function addLine() {
    onChange([...lines, blankLine()]);
  }

  function applyCatalogItem(index: number, catalogItemId: string) {
    const patch = catalogPatch(catalogItemId);
    if (patch) updateLine(index, patch);
  }

  /** What picking a catalogue item fills in on a line. */
  function catalogPatch(catalogItemId: string): Partial<EditableVendorBillLine> | null {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return null;
    return {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      accountId: item.expenseAccountId,
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
    return (
      <PhoneBillLines
        lines={lines}
        onChange={onChange}
        currency={currency}
        catalogItems={catalogItems}
        taxRates={taxRates}
        taxGroups={taxGroups}
        taxOptions={taxOptions}
        accountOptions={accountOptions}
        showHsn={showHsn}
        flaggedKeys={flaggedKeys}
        patchLine={patchLine}
        catalogPatch={(line, id) => catalogPatch(id)}
        addLabel={t("vendorBills.lineEditor.addLine")}
      />
    );
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
                    aria-label={t("vendorBills.lineEditor.moveLineUp")}
                    disabled={index === 0}
                    onClick={() => moveLine(index, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("vendorBills.lineEditor.moveLineDown")}
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
                      <Input value={line.name} onChange={(e) => updateLine(index, { name: e.target.value })} placeholder={t("vendorBills.lineEditor.itemName")} required />
                      <div className="w-48">
                        <Combobox
                          options={catalogOptions}
                          value={line.catalogItemId ?? undefined}
                          onValueChange={(id) => applyCatalogItem(index, id)}
                          placeholder={t("vendorBills.lineEditor.prefillFromCatalogue")}
                        />
                      </div>
                    </div>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder={t("vendorBills.lineEditor.descriptionPlaceholder")}
                    />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <FieldLabel label={t("vendorBills.lineEditor.qty")}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={String(line.quantity)}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        />
                      </FieldLabel>
                      <FieldLabel label={t("vendorBills.lineEditor.unitPrice")}>
                        <MoneyInput value={line.unitPriceAmount} onValueChange={(v) => updateLine(index, { unitPriceAmount: v })} currency={currency} />
                      </FieldLabel>
                      <FieldLabel label={t("vendorBills.lineEditor.lineTotal")}>
                        <div className="flex h-10 items-center justify-end rounded-sm border border-border bg-surface-sunken px-2.5 text-[14px] tabular-nums">
                          {formatMoney(preview.total, currency)}
                        </div>
                      </FieldLabel>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <FieldLabel label={t("vendorBills.lineEditor.expenseAccount")}>
                        <Combobox
                          options={accountOptions}
                          value={line.accountId ?? undefined}
                          onValueChange={(id) => updateLine(index, { accountId: id })}
                          placeholder={t("vendorBills.lineEditor.selectAccount")}
                        />
                      </FieldLabel>
                      <FieldLabel label={t("vendorBills.lineEditor.tax")}>
                        <Combobox options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder={t("vendorBills.lineEditor.noTax")} />
                      </FieldLabel>
                    </div>
                    <label className="flex h-10 w-fit cursor-pointer items-center gap-2 pb-0.5">
                      <Checkbox checked={line.isTaxInclusive} onCheckedChange={(v) => updateLine(index, { isTaxInclusive: v === true })} />
                      <span className="text-[13px] text-on-surface">{t("vendorBills.lineEditor.priceIncludesTax")}</span>
                    </label>
                    {flaggedKeys?.has(line.key) && <LineTaxWarning />}
                    {(showHsn || showsSupplyType(line.supplyClass, taxPercent)) && (
                      <div className={showHsn ? "grid grid-cols-1 items-start gap-2 md:grid-cols-2" : "flex flex-col"}>
                        {showHsn && <HsnSacField value={line.hsnSac} onChange={(hsnSac) => updateLine(index, { hsnSac })} />}
                        {showsSupplyType(line.supplyClass, taxPercent) && (
                          <SupplyTypeField value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => updateLine(index, { supplyClass })} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={t("vendorBills.lineEditor.removeLine")}
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
          <Plus size={14} /> {t("vendorBills.lineEditor.addLine")}
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

/** A new bill's one untouched blank line, which isn't shown as a card on a phone. */
function isUntouchedBillLine(line: EditableVendorBillLine): boolean {
  return line.type === "item" && !line.catalogItemId && !line.name.trim() && !line.description.trim() && line.unitPriceAmount === 0n && line.quantity === 1 && !line.accountId;
}

/** A line's tax for its card and sheet: the rate's or group's name with its percentage ("GST 18%"). */
function billLineTaxLabel(line: EditableVendorBillLine, taxRates: TaxRateOption[], taxGroups: TaxGroupOption[], t: ReturnType<typeof useT>): string | undefined {
  const percent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  if (!percent) return undefined;
  const name = line.taxRateId ? taxRates.find((r) => r.id === line.taxRateId)?.name : line.taxGroupId ? taxGroups.find((g) => g.id === line.taxGroupId)?.name : undefined;
  if (name) return name.includes("%") ? name : `${name} ${percent}%`;
  return t("invoices.linesTable.taxRate", { percent });
}

/**
 * US-OPS-59 (D-283) — a bill's (or vendor credit's) lines on a phone: one card per line, Add item
 * below, and one `LineSheet` editing a copy of the line — kept only with Done — with its fields in
 * one column (item, description, quantity, unit price, tax, account, HSN/SAC, supply type), and
 * Move up, Move down and Delete for a line that's already there. Used by `VendorBillLines` (bill
 * and vendor credit builders) and `VendorBillLineEditor` (recurring bills).
 */
export function PhoneBillLines({
  lines,
  onChange,
  currency,
  catalogItems,
  taxRates,
  taxGroups,
  taxOptions,
  accountOptions,
  showHsn,
  flaggedKeys,
  aiKeys,
  footerNote,
  patchLine,
  catalogPatch,
  addLabel,
  testId,
}: {
  lines: EditableVendorBillLine[];
  onChange: (lines: EditableVendorBillLine[]) => void;
  currency: string;
  catalogItems: CatalogItemOption[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  taxOptions: { value: string; label: string }[];
  accountOptions: { value: string; label: string }[];
  showHsn: boolean;
  flaggedKeys?: Set<string>;
  aiKeys?: Set<string>;
  footerNote?: string;
  /** The editor's own patch (the supply type follows the tax and the item). */
  patchLine: (line: EditableVendorBillLine, patch: Partial<EditableVendorBillLine>) => EditableVendorBillLine;
  /** What picking a catalogue item fills in on `line`; null when the item isn't there. */
  catalogPatch: (line: EditableVendorBillLine, catalogItemId: string) => Partial<EditableVendorBillLine> | null;
  addLabel: string;
  testId?: string;
}) {
  const t = useT();
  const [sheet, setSheet] = useState<{ index: number | null; draft: EditableVendorBillLine } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // A new bill's one untouched blank line isn't shown as a card.
  const shown = lines.length === 1 && isUntouchedBillLine(lines[0]!) ? [] : lines;
  const accountLabel = (id: string | null) => (id ? accountOptions.find((a) => a.value === id)?.label : undefined);
  const cards: PhoneLineCardData[] = shown.map((line) => {
    const preview = computeLinePreview(line, currency, taxRates, taxGroups);
    const flagged = flaggedKeys?.has(line.key) ?? false;
    const suggested = aiKeys?.has(line.key) ?? false;
    return {
      key: line.key,
      type: line.type,
      name: line.name,
      description: line.description,
      amount: formatMoney(preview.total, currency),
      detail: [t("common.lineSheet.qtyTimesRate", { qty: line.quantity, rate: formatMoney(line.unitPriceAmount, currency) }), accountLabel(line.accountId)].filter(Boolean).join(" · "),
      tax: billLineTaxLabel(line, taxRates, taxGroups, t),
      note:
        flagged || suggested ? (
          <>
            {flagged && <LineTaxWarning />}
            {suggested && <AiSuggestedTag className="mt-1" />}
          </>
        ) : undefined,
    };
  });
  const editing = sheet?.index ?? null;
  const update = (patch: Partial<EditableVendorBillLine>) => setSheet((cur) => (cur ? { ...cur, draft: patchLine(cur.draft, patch) } : cur));
  const commit = (): EditableVendorBillLine[] => {
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
  const draft = sheet?.draft;
  const draftPreview = draft ? computeLinePreview(draft, currency, taxRates, taxGroups) : null;
  const draftTax = draft ? billLineTaxLabel(draft, taxRates, taxGroups, t) : undefined;
  const draftTaxPercent = draft ? lineTaxPercent(resolveLineTaxRates(draft, taxRates, taxGroups)) : 0;
  const draftTaxValue = draft?.taxRateId ? `rate:${draft.taxRateId}` : draft?.taxGroupId ? `group:${draft.taxGroupId}` : "";
  const applyTaxSelection = (value: string) => {
    if (value.startsWith("rate:")) update({ taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
    else if (value.startsWith("group:")) update({ taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
    else update({ taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
  };

  return (
    <>
      <PhoneLineCards
        lines={cards}
        testId={testId}
        onOpen={(index) => setSheet({ index, draft: shown[index]! })}
        onAdd={() => setSheet({ index: null, draft: blankLine() })}
        addLabel={addLabel}
        extraAdds={
          footerNote ? (
            <span className="text-[12px] text-on-surface-muted" data-testid="bill-lines-note">
              {footerNote}
            </span>
          ) : undefined
        }
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {sheet && draft && draftPreview && (
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
          summary={
            <>
              <LineSheetSummaryRow label={t("common.lineSheet.qtyTimesRate", { qty: draft.quantity, rate: formatMoney(draft.unitPriceAmount, currency) })} value={formatMoney(draftPreview.subtotal, currency)} />
              {draftTax && <LineSheetSummaryRow label={draftTax} value={formatMoney(draftPreview.tax, currency)} />}
              <LineSheetSummaryRow label={t("common.lineSheet.lineAmount")} value={formatMoney(draftPreview.total, currency)} total />
            </>
          }
        >
          <LineSheetField label={t("common.lineSheet.item")}>
            <LineItemPicker
              name={draft.name}
              onNameChange={(name) => update({ name })}
              items={catalogItems}
              currency={currency}
              canSaveToCatalogue={false}
              saveToCatalogue={false}
              onPickItem={(id) => {
                const patch = catalogPatch(draft, id);
                if (patch) update(patch);
              }}
              onOneOff={() => update({ catalogItemId: null })}
            />
          </LineSheetField>
          <LineSheetField label={t("common.lineSheet.description")} htmlFor="bill-line-sheet-description">
            <Textarea id="bill-line-sheet-description" rows={2} value={draft.description} onChange={(e) => update({ description: e.target.value })} placeholder={t("vendorBills.lines.descriptionPlaceholder")} />
          </LineSheetField>
          <div className="grid grid-cols-2 gap-3">
            <LineSheetField label={t("common.lineSheet.quantity")} htmlFor="bill-line-sheet-qty">
              <Input id="bill-line-sheet-qty" type="number" inputMode="decimal" min={0} step="0.01" value={String(draft.quantity)} onChange={(e) => update({ quantity: Number(e.target.value) || 0 })} className="tabular-nums" />
            </LineSheetField>
            <LineSheetField label={t("common.lineSheet.unitPrice")} htmlFor="bill-line-sheet-price">
              <MoneyInput id="bill-line-sheet-price" value={draft.unitPriceAmount} onValueChange={(v) => update({ unitPriceAmount: v })} currency={currency} />
            </LineSheetField>
          </div>
          <LineSheetField label={t("common.lineSheet.tax")}>
            <Combobox aria-label={t("vendorBills.lines.tax")} options={taxOptions} value={draftTaxValue} onValueChange={applyTaxSelection} placeholder={t("vendorBills.lines.noTax")} />
          </LineSheetField>
          <label className="flex items-center gap-2.5 text-[14px] text-on-surface">
            <Checkbox checked={draft.isTaxInclusive} onCheckedChange={(v) => update({ isTaxInclusive: v === true })} />
            {t("vendorBills.lines.priceIncludesTax")}
          </label>
          <LineSheetField label={t("common.lineSheet.account")}>
            <Combobox aria-label={t("vendorBills.lines.account")} options={accountOptions} value={draft.accountId ?? undefined} onValueChange={(id) => update({ accountId: id })} placeholder={t("vendorBills.lineEditor.selectAccount")} />
          </LineSheetField>
          {showHsn && <HsnSacField value={draft.hsnSac} onChange={(hsnSac) => update({ hsnSac })} />}
          {showsSupplyType(draft.supplyClass, draftTaxPercent) && <SupplyTypeField value={draft.supplyClass} taxPercent={draftTaxPercent} onChange={(supplyClass) => update({ supplyClass })} />}
        </LineSheet>
      )}
    </>
  );
}
