"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "./api-client";

export type PushSupportState = "unsupported" | "not-configured" | "denied" | "unsubscribed" | "subscribed";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/**
 * PRD S-10.12 — owns the full browser-side push lifecycle: registering
 * `public/sw.js`, checking the current `PushSubscription`/`Notification`
 * permission state, and subscribing/unsubscribing against
 * `/notifications/push/*`. Kept as one hook (not spread across the bell +
 * a settings pane) since both need the same state and the settings pane is
 * the only place subscribe/unsubscribe should be triggered from (never on
 * page load unprompted, per the acceptance highlight).
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushSupportState>("unsubscribed");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      setLoading(false);
      return;
    }
    try {
      const { configured } = await apiClient.get<{ configured: boolean; publicKey: string | null }>("/notifications/push/public-key");
      if (!configured) {
        setState("not-configured");
        setLoading(false);
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        setLoading(false);
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsupported");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    const { configured, publicKey } = await apiClient.get<{ configured: boolean; publicKey: string | null }>("/notifications/push/public-key");
    if (!configured || !publicKey) {
      setState("not-configured");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "unsubscribed");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await apiClient.post("/notifications/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
    setState("subscribed");
  }, []);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await apiClient.delete(`/notifications/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`);
    }
    setState("unsubscribed");
  }, []);

  return { state, loading, subscribe, unsubscribe };
}
