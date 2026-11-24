"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

/** tokens.json breakpoints.wide-plus (D-209): from here the dashboard has a side column. */
const WIDE_PLUS = "(min-width: 90rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE_PLUS);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** US-DASH-29 — whether the window is 1440 px or wider. */
export function useWidePlus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_PLUS).matches,
    () => false,
  );
}

/** The card grid's row unit and the gap under each card, in px. */
export const ROW_UNIT = 8;
export const CARD_GAP = 16;

/** How many grid rows a card of this height takes, its gap included; 0 when it shows nothing. */
export function rowSpanFor(height: number): number {
  return height <= 0 ? 0 : Math.ceil((height + CARD_GAP) / ROW_UNIT);
}

/**
 * US-DASH-29 — a card keeps its own height: measure it and span that many
 * small rows, so the dense grid drops each card into the shortest column.
 * A card that renders nothing (no right to see it, or it failed) takes no
 * space at all.
 */
export function useRowSpan() {
  const [span, setSpan] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const measure = () => setSpan(rowSpanFor(el.getBoundingClientRect().height));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  const style: React.CSSProperties | undefined = span === null ? undefined : span === 0 ? { display: "none" } : { gridRowEnd: `span ${span}` };
  return { ref, style };
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * US-DASH-29 — the side column stays in view while the page scrolls, but
 * only when it fits the window; a taller one scrolls with the page so
 * nothing in it is out of reach.
 */
export function useFitsWindow<T extends HTMLElement>() {
  const [fits, setFits] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const ref = useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const check = () => {
      const viewport = scrollParent(el)?.clientHeight ?? window.innerHeight;
      setFits(el.getBoundingClientRect().height + 32 <= viewport);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    window.addEventListener("resize", check);
    cleanup.current = () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);
  return { ref, fits };
}
