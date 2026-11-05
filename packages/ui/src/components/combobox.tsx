"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import * as Popover from "@radix-ui/react-popover";

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second, muted line under the label (e.g. what an expense category is for); search looks at it too. */
  description?: string | null;
}

export interface ComboboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange" | "type" | "children"> {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /**
   * When set, typing a value that matches no existing option's label shows
   * a "Create '<value>'" row — selecting it calls `onValueChange` with the
   * typed text verbatim, for fields backed by an open-ended, org-defined
   * vocabulary (e.g. a catalogue item's unit or category) rather than a
   * fixed list. The trigger then displays whatever free-text value it was
   * given even if it isn't in `options` (falls back to showing `value`
   * itself instead of resolving through `options` for a label).
   */
  allowCreate?: boolean;
}

/**
 * Custom-dropdown counterpart to Select, per docs/DESIGN.md — reach for
 * this over Select when the list needs search-as-you-type filtering
 * (e.g. picking a contact/item from a long catalogue), and set
 * `allowCreate` when the list is an open-ended, org-defined vocabulary
 * rather than a fixed set (e.g. free-text units/categories that should
 * still suggest previously-used values).
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  emptyText,
  className,
  disabled,
  allowCreate = false,
  ...triggerProps
}: ComboboxProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const trimmedSearch = search.trim();
  const canCreate =
    allowCreate && trimmedSearch.length > 0 && !options.some((option) => option.label.toLowerCase() === trimmedSearch.toLowerCase());

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50",
            !selected && !(allowCreate && value) && "text-on-surface-muted",
            className,
          )}
          {...triggerProps}
        >
          <span className="truncate">{selected?.label ?? (allowCreate ? value : undefined) ?? placeholder ?? t("ui.combobox.placeholder")}</span>
          <ChevronsUpDown size={16} className="shrink-0 text-on-surface-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[var(--z-popover)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-raised"
        >
          <CommandPrimitive shouldFilter className="w-full">
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t("ui.combobox.searchPlaceholder")}
              className="w-full border-b border-border px-3 py-2 text-[14px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
            />
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              {!canCreate && (
                <CommandPrimitive.Empty className="px-2 py-4 text-center text-[13px] text-on-surface-muted">
                  {emptyText ?? t("ui.combobox.empty")}
                </CommandPrimitive.Empty>
              )}
              {options.map((option) => (
                <CommandPrimitive.Item
                  key={option.value}
                  value={option.label}
                  keywords={option.description ? [option.description] : undefined}
                  onSelect={() => {
                    onValueChange(option.value);
                    handleOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[14px] text-on-surface data-[selected=true]:bg-surface-sunken"
                >
                  {option.description ? (
                    <span className="flex min-w-0 flex-col">
                      <span>{option.label}</span>
                      <span className="text-[12px] text-on-surface-muted">{option.description}</span>
                    </span>
                  ) : (
                    option.label
                  )}
                  {option.value === value && <Check size={14} className="shrink-0" />}
                </CommandPrimitive.Item>
              ))}
              {canCreate && (
                <CommandPrimitive.Item
                  value={`__create__${trimmedSearch}`}
                  onSelect={() => {
                    onValueChange(trimmedSearch);
                    handleOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5 text-[14px] text-on-surface data-[selected=true]:bg-surface-sunken"
                >
                  <Plus size={14} className="shrink-0" />
                  {t("ui.combobox.create", { value: trimmedSearch })}
                </CommandPrimitive.Item>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
