"use client";

import { Slot } from "@radix-ui/react-slot";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../lib/cn";

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
}

/**
 * The reusable container behind an admin app's sidebar shell, per
 * docs/DESIGN.md — a header slot (logo + collapse toggle), grouped NavItem
 * lists, collapsible to an icon-only rail, with an optional footer slot
 * (user menu). New admin-style screens should compose this rather than
 * re-deriving the sidebar shell per app.
 */
export function Sidebar({ collapsed = false, className, children, ...props }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-[width] duration-base",
        collapsed ? "w-16" : "w-60",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Logo (or any header content) shown alongside the collapse toggle. */
  logo?: React.ReactNode;
  collapsed?: boolean;
  /** Renders the built-in collapse toggle button when provided — omit to hide it (e.g. a fixed-width, non-collapsible sidebar). */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * The sidebar's header row. Pass `logo` + `onCollapsedChange` to get the
 * built-in logo + collapse-toggle row for free; omit both and pass
 * `children` instead for a fully custom header.
 */
export function SidebarHeader({
  logo,
  collapsed = false,
  onCollapsedChange,
  className,
  children,
  ...props
}: SidebarHeaderProps) {
  if (logo || onCollapsedChange) {
    return (
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-3",
          collapsed ? "justify-center px-0" : "gap-2",
          className,
        )}
        {...props}
      >
        {logo}
        {!collapsed ? <div className="flex-1" /> : null}
        {onCollapsedChange ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex h-14 items-center gap-2 border-b border-border px-3", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
}

export function SidebarGroupLabel({ collapsed = false, className, ...props }: SidebarGroupLabelProps) {
  if (collapsed) return null;
  return (
    <div
      className={cn("mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted", className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-border p-2", className)} {...props} />;
}

export interface SidebarNavItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  /**
   * Render as the child element (e.g. a Next.js `<Link>`) instead of a
   * `<button>`, via Radix Slot — lets a router-aware anchor carry these
   * styles/active-state without @spine/ui depending on next/link. Slot
   * requires exactly one child element, so in this mode pass the fully
   * composed icon+label markup as `children` of that single element
   * yourself (the `icon` prop is ignored — it only applies to the default
   * `<button>` rendering).
   */
  asChild?: boolean;
}

/** A single sidebar row — icon + label, active state per the nav-item-active token. Disabled items render greyed-out, not omitted. */
export function SidebarNavItem({
  icon,
  active = false,
  disabled = false,
  collapsed = false,
  asChild = false,
  className,
  children,
  ...props
}: SidebarNavItemProps) {
  const itemClassName = cn(
    "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
    active ? "bg-surface-sunken text-primary" : "text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface",
    className,
  );

  if (asChild) {
    return (
      <Slot aria-current={active ? "page" : undefined} className={itemClassName} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={itemClassName}
      {...props}
    >
      <span className="shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>
      {!collapsed && <span className="truncate">{children}</span>}
    </button>
  );
}
