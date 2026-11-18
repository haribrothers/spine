"use client";

import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export interface BottomTabBarItem {
  /** A stable key, e.g. "sales". */
  key: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  current: boolean;
}

export interface BottomTabBarProps {
  items: BottomTabBarItem[];
  /**
   * Renders each tab's link (e.g. a Next.js `<Link>`), as `AppShellSidebar` does, so
   * `@spine/ui` doesn't depend on next/link. Forward `className`, `aria-current` and `children`.
   */
  renderLink: (item: BottomTabBarItem, props: { className: string; "aria-current"?: "page"; children: React.ReactNode }) => React.ReactNode;
  /** A tab that isn't a link (More opens a sheet). */
  renderButton?: (item: BottomTabBarItem, props: { className: string; children: React.ReactNode }) => React.ReactNode;
  /** Keys rendered with `renderButton` instead of `renderLink`. */
  buttonKeys?: string[];
  className?: string;
}

const TAB_CLASS =
  "flex min-h-[52px] min-w-11 flex-1 flex-col items-center justify-center gap-[3px] rounded-md text-[12px] font-medium text-on-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

/** The classes for a tab, current or not: a tinted pill behind the icon and a heavier label. */
function tabClasses(current: boolean): { pill: string; label: string; tab: string } {
  return {
    pill: cn("flex h-[30px] w-14 items-center justify-center rounded-full [&_svg]:h-[22px] [&_svg]:w-[22px]", current && "bg-info-bg [&_svg]:stroke-[2.25]"),
    label: cn(current && "font-[650] text-primary"),
    tab: cn(TAB_CLASS, current && "text-primary"),
  };
}

const currentPage = (current: boolean): "page" | undefined => (current ? "page" : undefined);

/**
 * US-OPS-54 (D-283) — the bar along the bottom of the web app under 768px: up to five
 * tabs, each an icon over its label. The current tab has a tinted pill behind its icon,
 * a heavier label and `aria-current="page"`, never colour alone. It's docked to the
 * bottom edge above the home indicator, and hides itself while a text field has focus
 * on a touch screen or a full-screen sheet is open (`[data-phone-fullscreen]`).
 * Hidden from 768px up.
 */
export function BottomTabBar({ items, renderLink, renderButton, buttonKeys = [], className }: BottomTabBarProps) {
  const t = useT();
  return (
    <nav
      aria-label={t("ui.bottomTabBar.label")}
      data-tabbar=""
      className={cn(
        "flex shrink-0 border-t border-border bg-surface px-1 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const { pill, label, tab } = tabClasses(item.current);
        const children = (
          <>
            <span className={pill}>{item.icon}</span>
            <span className={label}>{item.label}</span>
          </>
        );
        return (
          <div key={item.key} className="flex flex-1">
            {buttonKeys.includes(item.key) && renderButton
              ? renderButton(item, { className: tab, children })
              : renderLink(item, { className: tab, "aria-current": currentPage(item.current), children })}
          </div>
        );
      })}
    </nav>
  );
}
