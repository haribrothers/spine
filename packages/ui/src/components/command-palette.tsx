"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Kbd } from "./kbd";
import { Spinner } from "./spinner";

export interface CommandPaletteItem {
  /** Unique across all groups; what `onSelect` hands back. */
  id: string;
  title: string;
  subtitle?: string | null;
  /** Shown on the right, e.g. a status ("Overdue"). */
  meta?: string | null;
}

export interface CommandPaletteGroup {
  heading: string;
  items: CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's accessible name, e.g. "Search". */
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  groups: CommandPaletteGroup[];
  onSelect: (item: CommandPaletteItem) => void;
  /** A search is in flight. */
  loading?: boolean;
  /** Shown when the query is long enough and nothing came back. */
  emptyMessage?: React.ReactNode;
  /** Shown before anything is typed. */
  hint?: React.ReactNode;
  /** Keyboard hints and a note along the bottom. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * US-OPS-22/23 (D-033) — a search palette: a modal dialog named by `label`,
 * a combobox field controlling a listbox of grouped results (title, second
 * line, status on the right), arrow keys to move, Enter to open, Escape to
 * close with focus returned to where it was. The caller does the searching
 * (`query`/`groups`); the palette never filters on its own. It scales in
 * only when the person allows motion.
 */
export function CommandPalette({
  open,
  onOpenChange,
  label,
  query,
  onQueryChange,
  placeholder,
  groups,
  onSelect,
  loading = false,
  emptyMessage,
  hint,
  footer,
  className,
}: CommandPaletteProps) {
  const hasResults = groups.some((g) => g.items.length > 0);
  // The highlighted option. When results change, the first one is highlighted
  // (and announced through aria-activedescendant) unless the current one is still there.
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const idsKey = ids.join("\u0000");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    // `idsKey` stands for `ids`: re-pick only when the set of results changes.
    setSelected((current) => {
      const now = idsKey ? idsKey.split("\u0000") : [];
      return now.includes(current) ? current : (now[0] ?? "");
    });
  }, [idsKey]);

  // Escape (or any close) puts focus back where it was before the palette
  // opened — also when it was opened by a keyboard shortcut, with no trigger.
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && !document.activeElement.closest("[data-testid='command-palette']")) {
      returnTo.current = document.activeElement;
    }
  }, [open]);

  // Screen readers follow the highlight through aria-activedescendant. cmdk
  // works it out once, before results that arrive later exist, so the
  // palette keeps it in step with the highlighted option itself.
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const option = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? []).find((el) => el.getAttribute("data-value") === selected);
    if (option?.id) input.setAttribute("aria-activedescendant", option.id);
    else input.removeAttribute("aria-activedescendant");
  });
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-scrim" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            const target = returnTo.current;
            if (target && target.isConnected) {
              e.preventDefault();
              target.focus();
            }
            returnTo.current = null;
          }}
          className={cn(
            "fixed left-1/2 top-[8vh] z-[var(--z-modal)] flex max-h-[80vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-overlay focus:outline-none motion-safe:animate-palette-in",
            className,
          )}
          data-testid="command-palette"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <CommandPrimitive label={label} shouldFilter={false} loop value={selected} onValueChange={setSelected} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search size={16} className="shrink-0 text-on-surface-muted" aria-hidden />
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={onQueryChange}
                placeholder={placeholder}
                aria-label={label}
                className="flex h-12 w-full bg-transparent text-[15px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
              />
              {loading && <Spinner size="sm" />}
              <DialogPrimitive.Close asChild>
                <button type="button" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close search">
                  <Kbd>Esc</Kbd>
                </button>
              </DialogPrimitive.Close>
            </div>
            {!hasResults && !loading && (emptyMessage || hint) && (
              <div className="px-3 py-8 text-center text-[13px] text-on-surface-muted" role="status">
                {emptyMessage ?? hint}
              </div>
            )}
            <CommandPrimitive.List ref={listRef} className={cn("min-h-0 flex-1 overflow-y-auto", hasResults && "p-2")}>
              {groups
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <CommandPrimitive.Group
                    key={group.heading}
                    heading={group.heading}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-on-surface-muted"
                  >
                    {group.items.map((item) => (
                      <CommandPrimitive.Item
                        key={item.id}
                        value={item.id}
                        onSelect={() => onSelect(item)}
                        className="flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2 outline-none data-[selected=true]:bg-info-bg"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14px] font-medium text-on-surface">{item.title}</span>
                          {item.subtitle && <span className="truncate text-[12px] text-on-surface-muted">{item.subtitle}</span>}
                        </span>
                        {item.meta && <span className="shrink-0 text-[12px] text-on-surface-muted">{item.meta}</span>}
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                ))}
            </CommandPrimitive.List>
            {footer && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-sunken px-4 py-2 text-[12px] text-on-surface-muted">{footer}</div>}
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
