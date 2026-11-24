"use client";

import { useState } from "react";
import { Button, Spinner } from "@spine/ui";
import { usePushSubscription } from "../lib/use-push-subscription";
import { SavedToast } from "../app/settings/saved-toast";
import { useT } from "../lib/i18n";

/**
 * PRD S-10.12 — the explicit, in-app-action-triggered opt-in required by
 * the acceptance highlight ("a browser permission prompt triggered by an
 * explicit in-app action, never on page load unprompted"). Per-device: this
 * pane only ever shows/controls the CURRENT browser's subscription state —
 * a user with several devices subscribes from each one separately, and
 * revoking here never touches subscriptions from other devices (S-10.12).
 *
 * US-NTF-12 — lives on every member's Settings › Your account › Notifications
 * (the subscription routes were always per-user), not in the Owner-only
 * organisation Settings.
 */
export function BrowserNotificationsSection() {
  const t = useT();
  const { state, loading, subscribe, unsubscribe } = usePushSubscription();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      if (state === "subscribed") {
        await unsubscribe();
      } else {
        await subscribe();
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="browser-notifications-heading" data-testid="browser-notifications">
      <div className="flex flex-col gap-1">
        <h3 id="browser-notifications-heading" className="text-[14px] font-semibold text-on-surface">
          {t("common.browserNotifications.heading")}
        </h3>
        <p className="text-[13px] text-on-surface-muted">
          {t("common.browserNotifications.description")}
        </p>
      </div>

      {state === "unsupported" ? (
        <div className="rounded-md border border-border bg-surface p-4">
          <span className="text-[13px] text-on-surface-muted">{t("common.browserNotifications.unsupported")}</span>
        </div>
      ) : state === "not-configured" ? (
        <div className="rounded-md border border-border bg-surface p-4">
          <span className="text-[13px] text-on-surface-muted">
            {t("common.browserNotifications.notConfigured")}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-on-surface">
              {state === "subscribed" ? t("common.browserNotifications.enabled") : state === "denied" ? t("common.browserNotifications.blocked") : t("common.browserNotifications.notEnabled")}
            </span>
            <span className="text-[13px] text-on-surface-muted">
              {state === "denied"
                ? t("common.browserNotifications.blockedHint")
                : state === "subscribed"
                  ? t("common.browserNotifications.enabledHint")
                  : t("common.browserNotifications.notEnabledHint")}
            </span>
          </div>
          <Button variant={state === "subscribed" ? "secondary" : "primary"} disabled={busy || state === "denied"} onClick={handleToggle}>
            {busy ? <Spinner size="sm" /> : state === "subscribed" ? t("common.browserNotifications.turnOff") : t("common.browserNotifications.turnOn")}
          </Button>
        </div>
      )}

      <SavedToast open={done} onOpenChange={setDone} />
    </section>
  );
}
