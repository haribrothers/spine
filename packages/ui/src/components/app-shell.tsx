"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { cn } from "../lib/cn";
import { DialogOverlay } from "./dialog";
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNavItem,
} from "./sidebar";

/**
 * The shared persistent app shell (sidebar + main content region) that every
 * signed-in area of Spine renders inside — first consumed by /dashboard and
 * /settings. Deliberately built as a compound component (AppShell.Sidebar,
 * .Header, .Content) rather than one prop-heavy component, matching the
 * codebase's existing Card/Sidebar/DataTable granularity: each consuming
 * page composes its own nav sections, breadcrumb, and header rather than
 * configuring a monolith through a giant props object.
 *
 * AppShell itself is just the outer flex row + full-height frame;
 * AppShellSidebar wraps Sidebar with the collapse state + user-menu footer
 * slot; AppShellContent is the scrollable main region; AppShellHeader is an
 * optional breadcrumb + title + description + action row for pages that
 * want it (a page can skip it and lay out its own header instead).
 */
export function AppShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // US-OPS-14 (D-066): under 768px a top bar sits above the content instead of the sidebar beside it.
  return <div data-print="flow" className={cn("flex h-screen w-full flex-col overflow-hidden bg-background md:flex-row", className)} {...props} />;
}

export interface AppShellNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface AppShellNavSection {
  label: string;
  items: AppShellNavItem[];
}

export interface AppShellSidebarProps {
  /** Logo/wordmark rendered in the sidebar header, swaps to a compact mark when collapsed — caller decides what that looks like. */
  logo: React.ReactNode;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  sections: AppShellNavSection[];
  /** Renders each item's href against the current path to compute active state — pass a plain equality/`startsWith` check from the consuming app's router (e.g. Next's `usePathname`). */
  isActive: (href: string) => boolean;
  /**
   * Renders the actual link element for a nav item (e.g. a Next.js
   * `<Link href={item.href}>{children}</Link>`) — kept generic so
   * @spine/ui doesn't depend on next/link. AppShellSidebar wraps the
   * returned element in `SidebarNavItem asChild` for icon/label/active
   * styling, so `renderLink` only needs to forward `children` through to
   * its anchor.
   */
  renderLink: (item: AppShellNavItem, children: React.ReactNode) => React.ReactNode;
  /** Pinned-to-bottom user menu content (avatar + name + dropdown) — fully caller-supplied since it depends on session data and the dropdown menu's own actions. */
  userMenu?: React.ReactNode;
  /** US-OPS-48 — shown under the logo, above the nav (the app's search field, or its icon when collapsed). */
  search?: React.ReactNode;
}

/**
 * The left nav rail: header (logo + collapse toggle), grouped nav sections,
 * and a pinned footer for the user menu. Nav content is entirely
 * caller-supplied (`sections`) — AppShell has no opinion on what pages
 * exist, only how they're laid out.
 */
export function AppShellSidebar({
  logo,
  collapsed,
  onCollapsedChange,
  sections,
  isActive,
  renderLink,
  userMenu,
  search,
}: AppShellSidebarProps) {
  return (
    <Sidebar collapsed={collapsed} className="hidden h-full shrink-0 md:flex">
      <SidebarHeader collapsed={collapsed} onCollapsedChange={onCollapsedChange} logo={logo} />
      {search ? <div className={cn("shrink-0 px-2 pt-2", collapsed && "flex justify-center")}>{search}</div> : null}
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label} collapsed={collapsed}>
            <SidebarGroupLabel collapsed={collapsed}>{section.label}</SidebarGroupLabel>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <SidebarNavItem key={item.href} active={active} collapsed={collapsed} asChild>
                  {renderLink(
                    item,
                    <>
                      <span className="shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
                      {/* Kept in the DOM (not unmounted) when collapsed so the
                          icon-only rail still has an accessible name — see the
                          matching fix/comment in sidebar.tsx's SidebarNavItem. */}
                      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                    </>,
                  )}
                </SidebarNavItem>
              );
            })}
          </SidebarGroup>
        ))}
      </SidebarContent>
      {userMenu ? <SidebarFooter>{userMenu}</SidebarFooter> : null}
    </Sidebar>
  );
}

export interface AppShellTopBarProps {
  /** The logo, as in the sidebar. */
  logo: React.ReactNode;
  /** Opens `AppShellMobileNav`. */
  onMenuClick: () => void;
  /** Right-hand controls: notifications and the avatar menu. */
  actions?: React.ReactNode;
  menuLabel?: string;
}

/**
 * US-OPS-14 (D-066) — the bar across the top under 768px, in place of the
 * sidebar: a menu button, the logo, then notifications and the avatar.
 * Every control is at least 44×44px. Hidden from 768px up.
 */
export function AppShellTopBar({ logo, onMenuClick, actions, menuLabel = "Open navigation" }: AppShellTopBarProps) {
  return (
    <header data-testid="app-top-bar" className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5 md:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={menuLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Menu size={22} aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-center">{logo}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}

export interface AppShellMobileNavProps extends Pick<AppShellSidebarProps, "sections" | "isActive" | "renderLink" | "search"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logo: React.ReactNode;
  /** Pinned to the bottom: the person's name and menu, and help. */
  footer?: React.ReactNode;
  /** Read by screen readers as the panel's name. */
  title?: string;
}

/**
 * US-OPS-14 (D-066) — the full navigation under 768px: slides in from the
 * left over a dimmed page, with a close button. Tapping the dimmed area,
 * pressing Escape or following a link closes it. Same sections as the
 * sidebar, expanded.
 */
export function AppShellMobileNav({ open, onOpenChange, logo, sections, isActive, renderLink, search, footer, title = "Navigation" }: AppShellMobileNavProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay className="md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="mobile-nav"
          className="fixed inset-y-0 left-0 z-[var(--z-modal)] flex w-[min(300px,calc(100%-48px))] flex-col border-r border-border bg-surface shadow-overlay focus:outline-none motion-safe:animate-nav-in md:hidden"
          // A followed link closes the panel.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a[href]")) onOpenChange(false);
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-3 pr-1.5">
            {logo}
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="flex h-11 w-11 items-center justify-center rounded-md text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={20} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          {search ? <div className="shrink-0 px-2 pt-2">{search}</div> : null}
          <SidebarContent>
            {sections.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                {section.items.map((item) => (
                  <SidebarNavItem key={item.href} active={isActive(item.href)} className="min-h-11" asChild>
                    {renderLink(
                      item,
                      <>
                        <span className="shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </>,
                    )}
                  </SidebarNavItem>
                ))}
              </SidebarGroup>
            ))}
          </SidebarContent>
          {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface AppShellHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  description?: string;
  /** Top-right primary action slot — typically a single Button, per docs/DESIGN.md's one-primary-action rule. */
  action?: React.ReactNode;
  className?: string;
}

/** Breadcrumb + page title + description + optional primary action, above a page's content. */
export function AppShellHeader({ breadcrumb, title, description, action, className }: AppShellHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3", className)}>
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
      {/* US-OPS-14: under 768px the actions wrap onto their own row, under the title. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
          {description ? <p className="text-[14px] text-on-surface-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex min-w-0 flex-wrap items-center gap-2 md:shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export interface AppShellContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Opts this page out of the design system's default 1200px reading-width
   * cap — for pages whose content is wide by nature (a multi-column board,
   * a dense table) rather than form/prose content, where capping width just
   * wastes screen real estate on a large monitor. The page's own inner
   * content is still free to declare its own min-width and scroll
   * independently (e.g. Kanban) — this prop only removes the outer cap,
   * it doesn't guarantee everything fits without scrolling.
   */
  fullWidth?: boolean;
  /** App-wide notices (`Banner`) shown full-width above the page, outside the width cap. */
  banner?: React.ReactNode;
}

/** The scrollable main content region, capped to the design system's 1200px max-width container by default — see `fullWidth` to opt out. */
export function AppShellContent({ className, fullWidth = false, banner, children, ...props }: AppShellContentProps) {
  return (
    <main data-print="flow" className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", className)} {...props}>
      {banner}
      <div className={cn("mx-auto w-full p-4 md:p-6 lg:p-8", fullWidth ? "max-w-none" : "max-w-[1200px]")}>{children}</div>
    </main>
  );
}
