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
import { itemTaxFor, type SupplyType } from "@spine/shared";
import { EllipsisVertical, GripVertical, Plus } from "lucide-react";
import { LineItemPicker } from "../../../components/line-item-picker";
import { LineTaxWarning } from "../../../components/place-of-supply";
import { HsnSacField } from "../../../components/hsn-sac-field";
import { lineTaxPercent, showsSupplyType, SupplyTypeField, withSupplyClass } from "../../../components/supply-type-field";
import { apiClient } from "../../../lib/api-client";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { formatMoney } from "../../../lib/money";
import { blankLine, computeLinePreview, resolveLineTaxRates, type EditableVendorBillLine } from "./vendor-bill-line-editor";
import type { AccountOption, CatalogItemOption, TaxGroupOption, TaxRateOption } from "./types";

/** One grid for the header and every row: handle, item, qty, rate, tax, account, amount, menu. Wraps under 1024 px. */
const ROW_GRID = "grid grid-cols-[24px_repeat(5,minmax(0,1fr))_32px] gap-2 lg:grid-cols-[24px_minmax(0,1fr)_76px_112px_150px_180px_112px_32px]";

/**
 * US-PUR-35 (D-225) — the bill builder's lines, in the quote and invoice
 * builders' compact rows (US-QUO-34): drag handle, item, qty, rate, tax,
 * account and amount, with the description and HSN/SAC under each. The
 * Account column takes Disc. %'s place — a bill line debits an expense
 * account and has no discount. Item lines only: a bill isn't printed, so
 * there are no headings or text lines, and no bundles or "Also save to
 * catalogue". Rows move by the handle, the row menu or Alt + ↑/↓; Enter in
 * the last row's account adds a row.
 */
export function VendorBillLines({
  lines,
  onChange,
  currency,
  supplyType = null,
  exportUnderLut = false,
  flaggedKeys,
  showHsn = false,
}: {
  lines: EditableVendorBillLine[];
  onChange: (lines: EditableVendorBillLine[]) => void;
  currency: string;
  /** US-TAX-13 — picks each item's intra- or inter-state tax. */
  supplyType?: SupplyType | null;
  /** D-181 — exports under LUT have no IGST. */
  exportUnderLut?: boolean;
  /** US-TAX-13 — lines changed by hand when the place of supply changed. */
  flaggedKeys?: Set<string>;
  /** US-TAX-14 — show HSN/SAC on item lines (GST is on). */
  showHsn?: boolean;
}) {
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    apiClient.get<CatalogItemOption[]>("/catalog-items?picker=1").then(setCatalogItems).catch(() => {});
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient
      .get<Record<string, AccountOption[]>>("/org/accounts")
      .then((res) => setExpenseAccounts(res.expense ?? []))
      .catch(() => {});
  }, []);

  const accountOptions = useMemo(() => expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })), [expenseAccounts]);
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
    next[index] = withSupplyClass(merged, patch, lineTaxPercent(resolveLineTaxRates(merged, taxRates, taxGroups)), catalogItems.find((i) => i.id === merged.catalogItemId), taxRates);
    onChange(next);
  }

  function applyCatalogItem(index: number, catalogItemId: string) {
    const item = catalogItems.find((i) => i.id === catalogItemId);
    if (!item) return;
    updateLine(index, {
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPriceAmount: BigInt(item.defaultPriceAmount),
      accountId: item.expenseAccountId ?? lines[index]!.accountId,
      taxRatePercentage: item.defaultTaxRateId || item.defaultTaxGroupId ? 0 : item.defaultTaxRatePercentage,
      // US-TAX-13: the item's inter-state tax outside my state.
      ...itemTaxFor(item, supplyType, { exportUnderLut }),
      // US-TAX-14: the item's HSN/SAC code, changeable on the line.
      hsnSac: item.hsnSac ?? "",
    });
  }

  // A new row starts with its Item field focused.
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
    onChange([...without.slice(0, to), lines[from]!, ...without.slice(to)]);
    setAnnouncement(`Moved to position ${to + 1} of ${lines.length}`);
  }

  function addAndFocus() {
    const line = blankLine();
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
        <span>Tax</span>
        <span>Account</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <div className="flex flex-col" data-testid="bill-lines">
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
            <BillLineRow
              line={line}
              index={index}
              count={lines.length}
              currency={currency}
              catalogItems={catalogItems}
              taxOptions={taxOptions}
              accountOptions={accountOptions}
              taxRates={taxRates}
              taxGroups={taxGroups}
              showHsn={showHsn}
              onChange={(patch) => updateLine(index, patch)}
              onApplyCatalogItem={(id) => applyCatalogItem(index, id)}
              onMove={(to) => moveTo(index, to)}
              onRemove={() => onChange(lines.filter((_, i) => i !== index))}
              onDragStart={() => setDragKey(line.key)}
              onDragEnd={() => {
                setDragKey(null);
                setOver(null);
              }}
              onEnterLast={index === lines.length - 1 ? addAndFocus : undefined}
            />
            {flaggedKeys?.has(line.key) && <LineTaxWarning />}
          </div>
        ))}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <Button type="button" variant="secondary" size="sm" onClick={addAndFocus}>
          <Plus size={14} /> Add item
        </Button>
        <span className="ml-auto hidden text-[12px] text-on-surface-muted lg:inline">
          Enter adds a row · <Kbd>Alt</Kbd> + <Kbd>↑</Kbd>/<Kbd>↓</Kbd> moves it
        </span>
      </div>
    </div>
  );
}

function BillLineRow({
  line,
  index,
  count,
  currency,
  catalogItems,
  taxOptions,
  accountOptions,
  taxRates,
  taxGroups,
  showHsn,
  onChange,
  onApplyCatalogItem,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
  onEnterLast,
}: {
  line: EditableVendorBillLine;
  index: number;
  count: number;
  currency: string;
  catalogItems: CatalogItemOption[];
  taxOptions: { value: string; label: string }[];
  accountOptions: { value: string; label: string }[];
  taxRates: TaxRateOption[];
  taxGroups: TaxGroupOption[];
  showHsn: boolean;
  onChange: (patch: Partial<EditableVendorBillLine>) => void;
  onApplyCatalogItem: (id: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEnterLast?: () => void;
}) {
  const [details, setDetails] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const preview = computeLinePreview(line, currency, taxRates, taxGroups);
  const taxPercent = lineTaxPercent(resolveLineTaxRates(line, taxRates, taxGroups));
  const taxValue = line.taxRateId ? `rate:${line.taxRateId}` : line.taxGroupId ? `group:${line.taxGroupId}` : "";
  const showSupply = showsSupplyType(line.supplyClass, taxPercent);
  const showDetails = details || Boolean(line.description) || showHsn || showSupply || line.isTaxInclusive;

  function applyTaxSelection(value: string) {
    if (value.startsWith("rate:")) onChange({ taxRateId: value.slice(5), taxGroupId: null, taxRatePercentage: 0 });
    else if (value.startsWith("group:")) onChange({ taxRateId: null, taxGroupId: value.slice(6), taxRatePercentage: 0 });
    else onChange({ taxRateId: null, taxGroupId: null, taxRatePercentage: 0 });
  }

  return (
    <div ref={rowRef} className="flex flex-col gap-1.5">
      <div className={cn(ROW_GRID, "items-center")}>
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
        <div className="col-span-5 min-w-0 lg:col-span-1">
          <LineItemPicker
            name={line.name}
            onNameChange={(name) => onChange({ name })}
            items={catalogItems}
            currency={currency}
            canSaveToCatalogue={false}
            saveToCatalogue={false}
            onPickItem={onApplyCatalogItem}
            onOneOff={() => onChange({ catalogItemId: null })}
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
        <Combobox aria-label="Tax" options={taxOptions} value={taxValue} onValueChange={applyTaxSelection} placeholder="No tax" />
        <div
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnterLast) {
              e.preventDefault();
              onEnterLast();
            }
          }}
        >
          <Combobox aria-label="Account" options={accountOptions} value={line.accountId ?? undefined} onValueChange={(id) => onChange({ accountId: id })} placeholder="Account" />
        </div>
        <span className="text-right text-[13.5px] font-medium tabular-nums text-on-surface" data-testid="line-amount">
          {formatMoney(preview.total, currency)}
        </span>
        <span className="row-start-1 col-start-7 lg:row-start-auto lg:col-start-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Actions for line ${index + 1}`} className="flex h-9 w-8 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                <EllipsisVertical size={16} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
                <MENU_ICONS.moveUp aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
                <MENU_ICONS.moveDown aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={line.isTaxInclusive} onCheckedChange={(v) => onChange({ isTaxInclusive: v === true })}>
                Price includes tax
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onRemove}>
                <MENU_ICONS.delete aria-hidden />
                Remove line
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {showDetails ? (
        // The details row shares the line's grid — description under Item to Rate, HSN/SAC under Tax, supply type beside it.
        <div className={cn(ROW_GRID, "items-start")}>
          <Input
            aria-label="Description"
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (optional)"
            className="col-[2/span_5] h-8 text-[13px] lg:col-[2/span_3]"
          />
          {showHsn && (
            <div className="col-[2/span_2] lg:col-[5/span_1]">
              <HsnSacField compact value={line.hsnSac} onChange={(hsnSac) => onChange({ hsnSac })} />
            </div>
          )}
          {showSupply && (
            <div className={showHsn ? "col-[4/span_2] lg:col-[6/span_2]" : "col-[2/span_2] lg:col-[5/span_1]"}>
              <SupplyTypeField compact value={line.supplyClass} taxPercent={taxPercent} onChange={(supplyClass) => onChange({ supplyClass })} />
            </div>
          )}
        </div>
      ) : (
        <div className={ROW_GRID}>
          <button type="button" onClick={() => setDetails(true)} className="col-[2/span_5] flex w-fit items-center gap-1 text-[12.5px] font-medium text-primary hover:underline lg:col-[2/span_3]">
            <Plus size={13} aria-hidden /> Add description
          </button>
        </div>
      )}
    </div>
  );
}
