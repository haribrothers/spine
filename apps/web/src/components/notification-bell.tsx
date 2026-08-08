"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { NotificationDrawer } from "./notification-drawer";

/**
 * PRD S-10.11 — lives in `AppShellSidebar`'s footer (see app-layout.tsx),
 * the only persistent, always-visible chrome across every authenticated
 * page (confirmed before building this: `AppShell`/`AppShellContent` render
 * per-page content that scrolls away; there is no app-wide top bar). Placed
 * as a sibling to `AppUserMenu`, not inside it, so it stays reachable with
 * one click rather than nested in the user dropdown.
 *
 * Polls the unread COUNT independently of the drawer's own list fetch — a
 * cheap `{ count }` request every 20s regardless of whether the drawer is
 * open, matching this app's established "no WebSocket/SSE, poll instead"
 * convention (quote-detail.tsx, email-queue-dialog.tsx) but kept lightweight
 * since, unlike those two, this poll runs on every page, all the time.
 */
export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadCount = useCallback(() => {
    apiClient
      .get<{ count: number }>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 20000);
    return () => clearInterval(interval);
  }, [loadCount]);

  const hasUnread = Boolean(unreadCount);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={hasUnread ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className={
          collapsed
            ? "relative flex w-full items-center justify-center rounded-sm py-1.5 text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
            : "relative flex w-full items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-left text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        }
      >
        <span className="relative shrink-0">
          <Bell size={16} />
          {hasUnread && (
            // docs/DESIGN.md explicitly reserves the paid/due-soon/overdue/
            // draft palette for financial document status only ("never
            // repurpose... for a generic badge or tag") — this uses
            // --color-primary instead, the one accent color the design
            // system allots to "the one primary action/signal per screen."
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-inverse-on-surface">
              {unreadCount! > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
        {!collapsed && <span className="text-[13px] font-medium">Notifications</span>}
      </button>
      <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onUnreadChange={loadCount} />
    </>
  );
}
