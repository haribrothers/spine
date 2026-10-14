"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";

export interface ToastOptions {
  /** How long this toast stays, in milliseconds; the host's `duration` when left out. */
  duration?: number;
  /** For tests that look for one kind of toast (the permission toast). */
  testId?: string;
}

/** Show a toast: the thing and the past tense, then what changed or what to do next. */
export type ShowToast = (title: string, description?: string, options?: ToastOptions) => void;

interface HostedToast extends ToastOptions {
  id: number;
  title: string;
  description?: string;
  open: boolean;
}

const ToastContext = createContext<ShowToast | null>(null);

/** Below Tailwind's `sm` breakpoint the stack spans the bottom of the screen and holds two. */
const PHONE_QUERY = "(max-width: 639px)";
const PHONE_MAX = 2;

/**
 * US-OPS-38 (D-223) — the app's one toast host. It sits in the app layout,
 * which stays mounted across pages, so a toast shown just before
 * `router.push` shows on the page that opens. Toasts stack newest on top,
 * up to `max` (two at phone width); a new one over the maximum closes the
 * oldest at once. Each closes after its own `duration`; hovering the stack
 * or focusing a toast pauses them all (Radix). Never for errors — those
 * stay where the action was.
 */
export function ToastHost({ max = 3, duration = 5000, children }: { max?: number; duration?: number; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<HostedToast[]>([]);
  const [phone, setPhone] = useState(false);
  const nextId = useRef(0);
  const limit = phone ? Math.min(max, PHONE_MAX) : max;
  const limitRef = useRef(limit);
  limitRef.current = limit;

  useEffect(() => {
    const query = window.matchMedia?.(PHONE_QUERY);
    if (!query) return;
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const show = useCallback<ShowToast>((title, description, options) => {
    const id = ++nextId.current;
    setToasts((current) => {
      const open = [...current.filter((t) => t.open), { id, title, description, open: true, ...options }];
      return open.slice(Math.max(0, open.length - limitRef.current));
    });
  }, []);

  // Narrowing the window to phone width closes the oldest over the new maximum.
  useEffect(() => {
    setToasts((current) => (current.length > limit ? current.slice(current.length - limit) : current));
  }, [limit]);

  function close(id: number) {
    // Closed first so Radix can fade it, then gone.
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, open: false } : t)));
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 200);
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastProvider swipeDirection="right" duration={duration}>
        {/* Oldest first in the page; the viewport shows them newest on top. */}
        {toasts.map((t) => (
          <Toast key={t.id} open={t.open} duration={t.duration} onOpenChange={(open) => !open && close(t.id)} data-testid={t.testId ?? "toast"}>
            <div className="min-w-0 flex-1">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
            <ToastClose className="mt-0.5" />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

/**
 * The app's toast (D-223): `const toast = useToast(); toast("Lead deleted", "…")`.
 * Outside a `ToastHost` (a test rendering one screen) it does nothing.
 */
export function useToast(): ShowToast {
  return useContext(ToastContext) ?? noToast;
}

const noToast: ShowToast = () => {};
