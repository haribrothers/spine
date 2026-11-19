"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export interface AppShellPhoneBarProps {
  /** The page's title (never the logo). */
  title: string;
  /** Shown on records and pages below an area's first page. */
  onBack?: () => void;
  /** US-OPS-59: a builder has Cancel at the top left instead (it asks before unsaved changes are lost), the title centred and nothing on the right. */
  onCancel?: () => void;
  /** Right-hand controls: search, notifications and at most one page action. */
  actions?: React.ReactNode;
}

/**
 * US-OPS-54 (D-283) — the top bar under 768px: a back arrow when there's somewhere to go
 * back to, the page's title, then search, notifications and at most one action. Clear of
 * the notch when opened from the home screen. Hidden from 768px up.
 */
export function AppShellPhoneBar({ title, onBack, onCancel, actions }: AppShellPhoneBarProps) {
  const t = useT();
  if (onCancel) {
    return (
      <header data-testid="app-top-bar" className="flex shrink-0 flex-col border-b border-border bg-surface pt-[env(safe-area-inset-top)] md:hidden">
        <div className="grid h-14 grid-cols-[88px_minmax(0,1fr)_88px] items-center px-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-self-start rounded-md px-3 text-[16px] text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("ui.appShell.cancel")}
          </button>
          <p data-testid="app-top-bar-title" className="truncate text-center text-[17px] font-semibold leading-tight text-on-surface">
            {title}
          </p>
        </div>
      </header>
    );
  }
  return (
    <header data-testid="app-top-bar" className="flex shrink-0 flex-col border-b border-border bg-surface pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex h-14 items-center px-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("ui.appShell.back")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft size={24} aria-hidden />
          </button>
        ) : null}
        <p data-testid="app-top-bar-title" className={cn("min-w-0 flex-1 truncate text-[18px] font-semibold leading-tight text-on-surface", onBack ? "pl-0.5" : "pl-3")}>
          {title}
        </p>
        {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
      </div>
    </header>
  );
}

const AREA_LINK =
  "inline-flex h-11 items-center whitespace-nowrap px-2.5 text-[14px] font-medium text-on-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";
const AREA_LINK_CURRENT = "font-semibold text-on-surface shadow-[inset_0_-2px_0_var(--color-primary)]";

function areaLinkProps(item: { label: string; current: boolean }): { className: string; "aria-current"?: "page"; children: React.ReactNode } {
  return { className: cn(AREA_LINK, item.current && AREA_LINK_CURRENT), "aria-current": item.current ? "page" : undefined, children: item.label };
}

export interface AppShellAreaNavProps {
  /** Names the row for screen readers: "Sales", "Money". */
  label: string;
  items: { href: string; label: string; current: boolean }[];
  /** Renders each link (e.g. Next.js `<Link>`); forward `className`, `aria-current` and `children`. */
  renderLink: (item: { href: string; label: string }, props: { className: string; "aria-current"?: "page"; children: React.ReactNode }) => React.ReactNode;
}

/**
 * US-OPS-54 — an area's pages in a row under the top bar (Sales: Quotes, Contacts,
 * Pipeline, Meetings, Catalogue), scrolling sideways, the current one underlined and
 * marked `aria-current`. Hidden from 768px up.
 */
export function AppShellAreaNav({ label, items, renderLink }: AppShellAreaNavProps) {
  if (items.length < 2) return null;
  return (
    <nav
      aria-label={label}
      data-testid="area-nav"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <span key={item.href} className="flex shrink-0">
          {renderLink(item, areaLinkProps(item))}
        </span>
      ))}
    </nav>
  );
}
