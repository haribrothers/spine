"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { Kbd } from "./kbd";
import { Spinner } from "./spinner";

export interface CommandPaletteItem {
  /** Unique across all groups; what `onSelect` hands back. */
  id: string;
  title: string;
  subtitle?: string | null;
  /** Shown on the right, e.g. a status ("Overdue"). */
  meta?: string | null;
  /** Colours the meta by what it says; muted when unset. */
  metaTone?: "danger" | "success" | "warning";
  /** An icon in a tile before the text (US-OPS-47), hidden from screen readers. */
  icon?: React.ReactNode;
  /** Text to bold instead of the palette's `highlight` (an amount or a phone number that matched). */
  highlight?: string | null;
  /** `link`: a one-line row in the primary colour with its icon bare, e.g. "See all invoices matching “har”" (US-OPS-40). */
  variant?: "link";
}

export interface CommandPaletteGroup {
  heading: string;
  items: CommandPaletteItem[];
}

const META_TONE: Record<NonNullable<CommandPaletteItem["metaTone"]>, string> = {
  danger: "text-overdue",
  success: "text-paid",
  warning: "text-due-soon",
};

/** `text` with each case-insensitive occurrence of `needle` in bold (US-OPS-47: bold, not colour alone). */
export function highlightText(text: string, needle: string | null | undefined): React.ReactNode {
  const n = needle?.trim();
  if (!n) return text;
  const lower = text.toLowerCase();
  const find = n.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(find); at !== -1; at = lower.indexOf(find, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="bg-transparent font-bold text-on-surface">
        {text.slice(at, at + n.length)}
      </mark>,
    );
    from = at + n.length;
  }
  if (!parts.length) return text;
  if (from < text.length) parts.push(text.slice(from));
  return parts;
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
  /** Bolded wherever it appears in a title or second line (US-OPS-47). */
  highlight?: string;
  /** Controls under the field, e.g. chips that narrow the search (US-OPS-49). */
  toolbar?: React.ReactNode;
  /** The row being opened: it shows a spinner (and "Opening…" is announced) until the caller clears it, e.g. while the next page loads. */
  pendingId?: string | null;
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
  highlight,
  toolbar,
  pendingId,
  className,
}: CommandPaletteProps) {
  const t = useT();
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
            // US-OPS-60 (D-283): on a phone search fills the screen, with Cancel instead of Esc.
            "max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]",
            className,
          )}
          data-testid="command-palette"
          data-phone-fullscreen=""
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <span className="sr-only" role="status">
            {pendingId ? t("ui.commandPalette.opening") : ""}
          </span>
          <CommandPrimitive label={label} shouldFilter={false} loop value={selected} onValueChange={setSelected} className="flex min-h-0 flex-1 flex-col">
            <div className={cn("flex items-center gap-2 px-4", !toolbar && "border-b border-border")}>
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
                {/* Escape closes too; out of the tab order so Tab goes from the field to the toolbar (US-OPS-49). */}
                <button type="button" tabIndex={-1} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("ui.commandPalette.closeSearch")}>
                  <Kbd className="max-md:hidden">{t("ui.commandPalette.escKey")}</Kbd>
                  <span className="hidden px-1 text-[15px] font-semibold text-primary max-md:inline">{t("ui.commandPalette.cancel")}</span>
                </button>
              </DialogPrimitive.Close>
            </div>
            {toolbar && <div className="border-b border-border px-4 pb-3">{toolbar}</div>}
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
                    {group.items.map((item) =>
                      item.variant === "link" ? (
                        <CommandPrimitive.Item
                          key={item.id}
                          value={item.id}
                          onSelect={() => onSelect(item)}
                          className="flex min-h-9 cursor-pointer select-none items-center gap-3 rounded-md px-3 text-[13px] font-medium text-primary outline-none data-[selected=true]:bg-info-bg"
                        >
                          {item.icon && (
                            <span className="flex w-7.5 shrink-0 justify-center [&_svg]:size-3.5" aria-hidden>
                              {item.icon}
                            </span>
                          )}
                          <span className="truncate">{item.title}</span>
                          {pendingId === item.id && <Loader2 size={14} className="ml-auto shrink-0 animate-spin" aria-hidden data-testid="command-palette-pending" />}
                        </CommandPrimitive.Item>
                      ) : (
                        <CommandPrimitive.Item
                          key={item.id}
                          value={item.id}
                          onSelect={() => onSelect(item)}
                          className="group flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-md px-3 py-1.5 outline-none data-[selected=true]:bg-info-bg"
                        >
                          {item.icon && (
                            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-on-surface-muted [&_svg]:size-4" aria-hidden>
                              {item.icon}
                            </span>
                          )}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[14px] font-medium text-on-surface">{highlightText(item.title, item.highlight ?? highlight)}</span>
                            {item.subtitle && <span className="truncate text-[12px] text-on-surface-muted">{highlightText(item.subtitle, item.highlight ?? highlight)}</span>}
                          </span>
                          {item.meta && <span className={cn("shrink-0 text-[12px] font-medium", item.metaTone ? META_TONE[item.metaTone] : "text-on-surface-muted")}>{item.meta}</span>}
                          {pendingId === item.id ? (
                            <Loader2 size={14} className="shrink-0 animate-spin text-on-surface-muted" aria-hidden data-testid="command-palette-pending" />
                          ) : (
                            <CornerDownLeft size={14} className="hidden shrink-0 text-on-surface-muted group-data-[selected=true]:block" aria-hidden />
                          )}
                        </CommandPrimitive.Item>
                      ),
                    )}
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
