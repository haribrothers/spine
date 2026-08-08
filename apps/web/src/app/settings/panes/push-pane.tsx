"use client";

import { useState } from "react";
import { Button, Spinner } from "@spine/ui";
import { usePushSubscription } from "../../../lib/use-push-subscription";
import { SavedToast } from "../saved-toast";

/**
 * PRD S-10.12 — the explicit, in-app-action-triggered opt-in required by
 * the acceptance highlight ("a browser permission prompt triggered by an
 * explicit in-app action, never on page load unprompted"). Per-device: this
 * pane only ever shows/controls the CURRENT browser's subscription state —
 * a user with several devices subscribes from each one separately, and
 * revoking here never touches subscriptions from other devices (S-10.12).
 */
export function PushPane() {
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
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Browser notifications</h2>
        <p className="text-[13px] text-on-surface-muted">
          Get a native notification on this device when something needs your attention — even if Spine isn't the tab you're looking at. Additive to
          the in-app notification panel and email; turning this off doesn't affect either.
        </p>
      </div>

      {state === "unsupported" ? (
        <div className="rounded-md border border-border p-4">
          <span className="text-[13px] text-on-surface-muted">This browser doesn't support push notifications.</span>
        </div>
      ) : state === "not-configured" ? (
        <div className="rounded-md border border-border p-4">
          <span className="text-[13px] text-on-surface-muted">
            Browser notifications aren't configured on this Spine instance. Ask your self-hoster to set a VAPID keypair.
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-on-surface">
              {state === "subscribed" ? "Enabled on this device" : state === "denied" ? "Blocked by the browser" : "Not enabled on this device"}
            </span>
            <span className="text-[13px] text-on-surface-muted">
              {state === "denied"
                ? "You've blocked notifications for Spine — re-enable them from your browser's site settings to turn this on."
                : state === "subscribed"
                  ? "This device will receive push notifications."
                  : "Turn this on to receive push notifications on this device."}
            </span>
          </div>
          <Button variant={state === "subscribed" ? "secondary" : "primary"} disabled={busy || state === "denied"} onClick={handleToggle}>
            {busy ? <Spinner size="sm" /> : state === "subscribed" ? "Turn off" : "Turn on"}
          </Button>
        </div>
      )}

      <SavedToast open={done} onOpenChange={setDone} />
    </div>
  );
}
