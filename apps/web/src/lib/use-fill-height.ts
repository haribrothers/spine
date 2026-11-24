"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * A height that runs from the element's top to the bottom of the window,
 * less `bottomGap` (by default the page's own bottom padding, so the page
 * doesn't scroll), never under `minHeight` — so a board or calendar fills
 * the page below its header (US-CRM-24, US-MTG-17). Call `measure()` again
 * once content above it has rendered.
 */
export function useFillHeight({ minHeight, bottomGap }: { minHeight: number; bottomGap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest("main");
    const top = el.getBoundingClientRect().top + (main?.scrollTop ?? 0);
    const wrapper = main?.firstElementChild instanceof HTMLElement && main.firstElementChild.contains(el) ? main.firstElementChild : null;
    const gap = bottomGap ?? (wrapper ? Number.parseFloat(window.getComputedStyle(wrapper).paddingBottom) || 0 : 24);
    setHeight(Math.max(minHeight, Math.floor(window.innerHeight - top - gap)));
  }, [minHeight, bottomGap]);
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  return { ref, height, measure };
}
