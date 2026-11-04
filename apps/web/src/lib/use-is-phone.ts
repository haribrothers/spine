"use client";

import { useEffect, useState } from "react";

/** The phone layout's width (US-OPS-14, D-066): under 768px. */
export const PHONE_QUERY = "(max-width: 767.98px)";

/**
 * Whether the window is phone-width, kept current as it resizes. False
 * until mounted, so the first render matches the server's (the desktop
 * layout, which CSS hides under 768px anyway).
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
