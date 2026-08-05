"use client";

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

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex h-14 items-center gap-2 border-b border-border px-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
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
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
}

/** A single sidebar row — icon + label, active state per the nav-item-active token. Disabled items render greyed-out, not omitted. */
export function SidebarNavItem({
  icon,
  active = false,
  disabled = false,
  collapsed = false,
  className,
  children,
  ...props
}: SidebarNavItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-surface-sunken text-primary" : "text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface",
        className,
      )}
      {...props}
    >
      <span className="shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>
      {!collapsed && <span className="truncate">{children}</span>}
    </button>
  );
}
