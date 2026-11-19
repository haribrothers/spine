"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { BottomSheet } from "@spine/ui";
import { useIsPhone } from "./use-is-phone";
import { useT } from "./i18n";

/**
 * US-OPS-54 — the phone top bar holds at most one action for the page (Select, Done). A page
 * sets it with `usePhoneBarAction`; the shell renders it beside search and notifications.
 */
type Slot = "action" | "more";
const PhoneBarContext = createContext<{ slots: Record<Slot, React.ReactNode>; set: (slot: Slot, node: React.ReactNode) => void } | null>(null);

export function PhoneBarProvider({ children }: { children: React.ReactNode }) {
  const [slots, setSlots] = useState<Record<Slot, React.ReactNode>>({ action: null, more: null });
  const set = useCallback((slot: Slot, node: React.ReactNode) => setSlots((current) => ({ ...current, [slot]: node })), []);
  return <PhoneBarContext.Provider value={{ slots, set }}>{children}</PhoneBarContext.Provider>;
}

/** The page's action and its ⋯, for the shell to render. */
export function usePhoneBarSlot(): React.ReactNode {
  const slots = useContext(PhoneBarContext)?.slots;
  return slots ? (
    <>
      {slots.action}
      {slots.more}
    </>
  ) : null;
}

/** Puts `node` in the phone top bar while the page is mounted (and `node` is set). */
export function usePhoneBarAction(node: React.ReactNode, deps: unknown[], slot: Slot = "action") {
  const set = useContext(PhoneBarContext)?.set;
  useEffect(() => {
    set?.(slot, node);
    return () => set?.(slot, null);
    // The caller lists what the node depends on, as with useMemo.
  }, [set, slot, ...deps]);
}

/**
 * US-OPS-57 — a page's other actions (Recurring invoices, Import, Export, Refresh). From 768px
 * up they're inline, as they were. On a phone they're under the top bar's ⋯, one under another
 * in a sheet, so the page keeps one main action (its floating button).
 */
export function PhoneMoreActions({ children }: { children: React.ReactNode }) {
  const t = useT();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  // Only the ⋯ goes in the bar (it never changes); the sheet with the actions renders here.
  usePhoneBarAction(
    phone ? (
      <button
        type="button"
        aria-label={t("common.phone.moreActions.open")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Ellipsis size={22} aria-hidden />
      </button>
    ) : null,
    [phone],
    "more",
  );
  if (!phone) return <>{children}</>;
  return (
    <BottomSheet open={open} onOpenChange={setOpen} title={t("common.phone.moreActions.title")}>
      {/* Choosing one closes the sheet; each the full width, one under another. A menu's trigger
          (Export) keeps it open so its menu can show; choosing from that menu then closes it. */}
      <div
        className="flex flex-col gap-2 pt-1 [&>*]:w-full [&>*]:justify-start"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[aria-haspopup="menu"]')) return;
          setOpen(false);
        }}
      >
        {children}
      </div>
    </BottomSheet>
  );
}
/**
 * US-OPS-58 — a record's More menu. From 768px up it's the page's own More button and its menu.
 * On a phone the top bar's ⋯ opens the same menu (an action sheet, US-OPS-60) and the page hides
 * its More button. Spread `menu` on the `DropdownMenu` and `content` on its `DropdownMenuContent`;
 * `phone` says when to add the actions that are buttons on the desktop (Edit, Download PDF).
 */
export function usePhoneRecordMenu() {
  const t = useT();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  usePhoneBarAction(
    phone ? (
      <button
        ref={moreRef}
        type="button"
        aria-label={t("common.phone.moreActions.open")}
        aria-haspopup="menu"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Ellipsis size={22} aria-hidden />
      </button>
    ) : null,
    [phone],
    "more",
  );
  return {
    phone,
    menu: { open, onOpenChange: setOpen },
    // The page's More button is hidden on a phone, so focus goes back to the ⋯ that opened it.
    content: phone
      ? {
          onCloseAutoFocus: (event: Event) => {
            event.preventDefault();
            moreRef.current?.focus();
          },
        }
      : {},
  };
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
