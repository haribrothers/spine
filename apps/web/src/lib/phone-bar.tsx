"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useIsPhone } from "./use-is-phone";
import { useT } from "./i18n";

/**
 * US-OPS-54 — the phone top bar holds at most one action for the page (Select, Done). A page
 * sets it with `usePhoneBarAction`; the shell renders it beside search and notifications.
 */
const PhoneBarContext = createContext<{ action: React.ReactNode; setAction: (node: React.ReactNode) => void } | null>(null);

export function PhoneBarProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<React.ReactNode>(null);
  return <PhoneBarContext.Provider value={{ action, setAction }}>{children}</PhoneBarContext.Provider>;
}

/** The page's action, for the shell to render. */
export function usePhoneBarSlot(): React.ReactNode {
  return useContext(PhoneBarContext)?.action ?? null;
}

/** Puts `node` in the phone top bar while the page is mounted (and `node` is set). */
export function usePhoneBarAction(node: React.ReactNode, deps: unknown[]) {
  const setAction = useContext(PhoneBarContext)?.setAction;
  useEffect(() => {
    setAction?.(node);
    return () => setAction?.(null);
    // The caller lists what the node depends on, as with useMemo.
  }, [setAction, ...deps]);
}

/**
 * US-OPS-56 — Select mode for a list with bulk actions: on a phone the top bar has Select
 * (then Done), and rows show their checkboxes only while selecting. Done clears the selection
 * through `onDone`. From 768px up the checkbox column is always there, so it's always "selecting".
 */
export function useSelectMode({ available, onDone }: { available: boolean; onDone?: () => void }): boolean {
  const t = useT();
  const phone = useIsPhone();
  const [selecting, setSelecting] = useState(false);
  usePhoneBarAction(
    phone && available ? (
      <button
        type="button"
        onClick={() => {
          if (selecting) onDone?.();
          setSelecting((s) => !s);
        }}
        className="flex h-11 items-center rounded-md px-2.5 text-[15px] font-semibold text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {selecting ? t("common.phone.select.done") : t("common.phone.select.select")}
      </button>
    ) : null,
    [phone, available, selecting],
  );
  return !phone || selecting;
}
