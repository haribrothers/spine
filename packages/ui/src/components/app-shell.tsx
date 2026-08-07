"use client";

import { cn } from "../lib/cn";
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
  return <div className={cn("flex h-screen w-full overflow-hidden bg-background", className)} {...props} />;
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
}: AppShellSidebarProps) {
  return (
    <Sidebar collapsed={collapsed} className="h-full shrink-0">
      <SidebarHeader collapsed={collapsed} onCollapsedChange={onCollapsedChange} logo={logo} />
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
          {description ? <p className="text-[14px] text-on-surface-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/** The scrollable main content region, capped to the design system's 1200px max-width container. */
export function AppShellContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props}>
      <div className="mx-auto w-full max-w-[1200px] p-6 lg:p-8">{props.children}</div>
    </main>
  );
}
