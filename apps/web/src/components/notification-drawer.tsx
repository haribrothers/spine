"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  Spinner,
} from "@spine/ui";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "../lib/api-client";
import type { AppNotification } from "./notification-types";
import { useT } from "../lib/i18n";
import { orgLocaleTag } from "../lib/money";

/**
 * PRD S-10.11 — the right-side panel a click on `NotificationBell` opens.
 * Reuses `@spine/ui`'s existing `Drawer` (already a right-side slide-in
 * panel, per docs/DESIGN.md/S-F0) rather than a new primitive. Fetches the
 * list only while open (matching `email-queue-dialog.tsx`'s own "poll only
 * while visible" convention from Quotes Stage 2) — the bell's own unread
 * badge polls independently and far more cheaply (a count, not a list) even
 * while this drawer is closed.
 */
export function NotificationDrawer({
  open,
  onOpenChange,
  onUnreadChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful read/read-all so the bell's badge count can drop immediately instead of waiting for its own next poll tick. */
  onUnreadChange: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    apiClient
      .get<AppNotification[]>("/notifications")
      .then(setNotifications)
      .catch((err) => setError(err instanceof Error ? err.message : t("common.notifications.loadFailed")));
  }, [t]);

  useEffect(() => {
    if (!open) return;
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [open, load]);

  async function handleItemClick(item: AppNotification) {
    if (!item.readAt) {
      // Optimistic — the list re-renders with this item marked read
      // immediately rather than waiting for the next poll tick, matching
      // how quote-detail.tsx updates local state right after a successful
      // mutation elsewhere in this app.
      setNotifications((current) => current?.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)) ?? current);
      onUnreadChange();
      apiClient.post(`/notifications/${item.id}/read`).catch(() => {});
    }
    onOpenChange(false);
    if (item.link) router.push(item.link);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await apiClient.post("/notifications/read-all");
      setNotifications((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? current);
      onUnreadChange();
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" size="sm">
        <DrawerHeader>
          <DrawerTitle>{t("common.notificationBell.label")}</DrawerTitle>
          <DrawerDescription>{t("common.notifications.description")}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-1 p-0">
          {error ? (
            <p className="p-5 text-[13px] text-overdue">{error}</p>
          ) : !notifications ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={<Bell />} title={t("common.notifications.emptyTitle")} description={t("common.notifications.emptyDescription")} />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="flex items-start gap-2.5 px-5 py-3 text-left transition-colors hover:bg-surface-sunken"
                >
                  {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  <div className={item.readAt ? "min-w-0 flex-1 pl-[18px]" : "min-w-0 flex-1"}>
                    <p className="text-[13px] text-on-surface">{item.message}</p>
                    <p className="mt-0.5 text-[12px] text-on-surface-muted">{new Date(item.createdAt).toLocaleString(orgLocaleTag())}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DrawerBody>
        {notifications && notifications.length > 0 && (
          <DrawerFooter>
            <Button variant="secondary" size="sm" disabled={markingAll || unreadCount === 0} onClick={handleMarkAllRead}>
              {markingAll ? <Spinner size="sm" /> : <CheckCheck size={14} />}
              {t("common.notifications.markAllRead")}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
