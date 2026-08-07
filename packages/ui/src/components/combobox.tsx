"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import * as Popover from "@radix-ui/react-popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Custom-dropdown counterpart to Select, per docs/DESIGN.md — reach for
 * this over Select when the list needs search-as-you-type filtering
 * (e.g. picking a contact/item from a long catalogue).
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  emptyText = "No results found.",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-on-surface-muted",
            className,
          )}
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown size={16} className="shrink-0 text-on-surface-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[var(--z-popover)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-[0_4px_14px_rgba(33,31,26,0.10)]"
        >
          <CommandPrimitive shouldFilter className="w-full">
            <CommandPrimitive.Input
              placeholder="Search…"
              className="w-full border-b border-border px-3 py-2 text-[14px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
            />
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="px-2 py-4 text-center text-[13px] text-on-surface-muted">
                {emptyText}
              </CommandPrimitive.Empty>
              {options.map((option) => (
                <CommandPrimitive.Item
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-[14px] text-on-surface data-[selected=true]:bg-surface-sunken"
                >
                  {option.label}
                  {option.value === value && <Check size={14} />}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
