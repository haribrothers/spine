"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Checkbox, Input, Popover, PopoverAnchor, PopoverContent, cn } from "@spine/ui";
import { formatMoney } from "../lib/money";

export interface PickerCatalogItem {
  id: string;
  name: string;
  unit: string;
  defaultPriceAmount: string;
  archivedAt: string | null;
}

/** US-QUO-26 — a saved group of lines offered above the items. */
export interface PickerBundle {
  id: string;
  name: string;
  /** Total of the bundle's lines, in minor units. */
  totalAmount: bigint;
  /** "demolition, plumbing rough-in, tiling" */
  lineNames: string[];
}

type Option =
  | { kind: "bundle"; id: string; bundle: PickerBundle }
  | { kind: "item"; id: string; item: PickerCatalogItem }
  | { kind: "one-off"; id: "one-off" };

const MAX_MATCHES = 8;

/**
 * The item field on a quote or invoice line: type a name, and a list
 * offers matching bundles (US-QUO-26), then catalogue items, then — when
 * nothing matches exactly — "Use “<name>” as a one-off line", with "Also
 * save to catalogue" for members who may add catalogue items (US-CAT-06).
 * An ARIA combobox: arrows move, Enter chooses, Escape closes.
 */
export function LineItemPicker({
  name,
  onNameChange,
  items,
  bundles = [],
  currency,
  canSaveToCatalogue,
  saveToCatalogue,
  onPickItem,
  onPickBundle,
  onOneOff,
}: {
  name: string;
  onNameChange: (name: string) => void;
  items: PickerCatalogItem[];
  bundles?: PickerBundle[];
  currency: string;
  /** Has `catalog.edit_own`; otherwise "Also save to catalogue" isn't offered. */
  canSaveToCatalogue: boolean;
  /** Whether this line is marked to be saved to the catalogue. */
  saveToCatalogue: boolean;
  onPickItem: (id: string) => void;
  onPickBundle?: (id: string) => void;
  /** The typed name is kept as a one-off line, saved to the catalogue or not. */
  onOneOff: (saveToCatalogue: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [save, setSave] = useState(saveToCatalogue);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const query = name.trim().toLowerCase();
  const matchingBundles = useMemo(
    () => (query ? bundles.filter((b) => b.name.toLowerCase().includes(query)).slice(0, MAX_MATCHES) : []),
    [bundles, query],
  );
  const matchingItems = useMemo(
    () => (query ? items.filter((i) => !i.archivedAt && i.name.toLowerCase().includes(query)).slice(0, MAX_MATCHES) : []),
    [items, query],
  );
  const exact = matchingItems.some((i) => i.name.trim().toLowerCase() === query);
  const options: Option[] = [
    ...matchingBundles.map((bundle) => ({ kind: "bundle" as const, id: `bundle-${bundle.id}`, bundle })),
    ...matchingItems.map((item) => ({ kind: "item" as const, id: `item-${item.id}`, item })),
    ...(query && !exact ? [{ kind: "one-off" as const, id: "one-off" as const }] : []),
  ];
  const showList = open && options.length > 0;

  function choose(option: Option) {
    if (option.kind === "bundle") onPickBundle?.(option.bundle.id);
    else if (option.kind === "item") onPickItem(option.item.id);
    else onOneOff(canSaveToCatalogue && save);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (options.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (e.key === "Enter" && showList) {
      e.preventDefault();
      const option = options[Math.min(active, options.length - 1)];
      if (option) choose(option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const optionId = (option: Option) => `${listId}-${option.id}`;
  const firstItemIndex = matchingBundles.length;
  const oneOffIndex = options.findIndex((o) => o.kind === "one-off");

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="w-full">
          <Input
            ref={inputRef}
            role="combobox"
            aria-label="Item"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && options[active] ? optionId(options[active]!) : undefined}
            value={name}
            placeholder="Item name — type to search the catalogue"
            required
            onChange={(e) => {
              onNameChange(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => query && setOpen(true)}
            onBlur={(e) => {
              // Close when focus leaves for anywhere but the list (Tab can still reach "Also save to catalogue").
              if (!(e.relatedTarget instanceof Node && contentRef.current?.contains(e.relatedTarget))) setOpen(false);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[360px] max-w-xl p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && inputRef.current?.contains(e.target)) e.preventDefault();
        }}
      >
        <div id={listId} role="listbox" aria-label="Catalogue matches" className="flex max-h-80 flex-col overflow-y-auto py-1">
          {matchingBundles.length > 0 && <GroupLabel>Bundles</GroupLabel>}
          {matchingBundles.map((bundle, i) => {
            const option = options[i]!;
            return (
              <div
                key={option.id}
                id={optionId(option)}
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                className={cn("mx-1 flex cursor-pointer flex-col rounded-md px-3 py-2", active === i && "bg-info-bg")}
              >
                <span className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="font-semibold text-on-surface">{bundle.name}</span>
                  <span className="font-semibold tabular-nums text-on-surface">{formatMoney(bundle.totalAmount, currency)}</span>
                </span>
                <span className="text-[12px] text-on-surface-muted">
                  Adds {bundle.lineNames.length} {bundle.lineNames.length === 1 ? "line" : "lines"}: {bundle.lineNames.join(", ")}
                </span>
              </div>
            );
          })}
          {matchingItems.length > 0 && <GroupLabel>Items</GroupLabel>}
          {matchingItems.map((item, i) => {
            const index = firstItemIndex + i;
            const option = options[index]!;
            return (
              <div
                key={option.id}
                id={optionId(option)}
                role="option"
                aria-selected={active === index}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                className={cn("mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-[14px]", active === index && "bg-info-bg")}
              >
                <span className="text-on-surface">{item.name}</span>
                <span className="tabular-nums text-on-surface-muted">
                  {formatMoney(BigInt(item.defaultPriceAmount), currency)} / {item.unit}
                </span>
              </div>
            );
          })}
        </div>
        {oneOffIndex !== -1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-1 py-1">
            <div
              id={optionId(options[oneOffIndex]!)}
              role="option"
              aria-selected={active === oneOffIndex}
              aria-controls={listId}
              onMouseEnter={() => setActive(oneOffIndex)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(options[oneOffIndex]!)}
              className={cn("flex-1 cursor-pointer rounded-md px-3 py-2 text-[14px] text-on-surface", active === oneOffIndex && "bg-info-bg")}
            >
              Use “{name.trim()}” as a one-off line
            </div>
            {canSaveToCatalogue && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2 px-2 text-[13px] text-on-surface" onMouseDown={(e) => e.preventDefault()}>
                <Checkbox checked={save} onCheckedChange={(v) => setSave(v === true)} aria-label="Also save to catalogue" />
                Also save to catalogue
              </label>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div role="presentation" className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted">
      {children}
    </div>
  );
}
