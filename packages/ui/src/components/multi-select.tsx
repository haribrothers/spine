"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * The multi-value counterpart to Select, per docs/DESIGN.md — Radix's
 * react-select primitive has no multi-select mode, so this is composed
 * from Popover + a checkable option list instead, matching Combobox's
 * structure. The trigger shows as many selected labels as fit before
 * collapsing the rest into a "+N" chip, remeasured on selection change
 * and on trigger resize.
 */
export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  className,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => value.includes(option.value));

  const toggle = (optionValue: string) => {
    onValueChange(
      value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue],
    );
  };

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
            selected.length === 0 && "text-on-surface-muted",
            className,
          )}
        >
          {selected.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : (
            <MultiSelectValue labels={selected.map((option) => option.label)} />
          )}
          <ChevronsUpDown size={16} className="shrink-0 text-on-surface-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-popover w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-[0_4px_14px_rgba(33,31,26,0.10)]"
        >
          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => toggle(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(option.value);
                    }
                  }}
                  className="flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-[14px] text-on-surface outline-none hover:bg-surface-sunken data-[selected=true]:bg-surface-sunken"
                  data-selected={isSelected}
                >
                  {option.label}
                  {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Renders as many selected labels as fit the available trigger width,
 * collapsing the remainder into a "+N" chip. Measures with a full,
 * off-screen render pass on every layout change (labels, container
 * width) rather than guessing from character counts.
 */
function MultiSelectValue({ labels }: { labels: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(labels.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recompute = () => {
      const available = container.clientWidth;
      const chips = Array.from(measure.children) as HTMLElement[];
      const overflowWidth = measure.lastElementChild instanceof HTMLElement ? measure.lastElementChild.offsetWidth : 0;

      let used = 0;
      let count = 0;
      for (let i = 0; i < labels.length; i++) {
        const chip = chips[i];
        if (!chip) break;
        const chipWidth = chip.offsetWidth + (i > 0 ? 4 : 0);
        const remaining = labels.length - (i + 1);
        const reserve = remaining > 0 ? overflowWidth + 4 : 0;
        if (used + chipWidth + reserve > available && count > 0) break;
        used += chipWidth;
        count = i + 1;
      }
      setVisibleCount(Math.max(count, 1));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [labels]);

  const hiddenCount = labels.length - visibleCount;

  return (
    <div ref={containerRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <div ref={measureRef} className="pointer-events-none absolute -left-[9999px] top-0 flex gap-1" aria-hidden>
        {labels.map((label) => (
          <span key={label} className="inline-flex items-center rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium">
            {label}
          </span>
        ))}
        <span className="inline-flex items-center rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium">
          +{labels.length}
        </span>
      </div>
      {labels.slice(0, visibleCount).map((label) => (
        <span
          key={label}
          className="inline-flex shrink-0 items-center rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-on-surface"
        >
          {label}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-on-surface">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
