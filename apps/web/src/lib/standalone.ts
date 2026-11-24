"use client";

import { useEffect } from "react";

/** US-OPS-55: Spine opened from the home screen (no browser around it). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * US-OPS-55 — in the home-screen app there's no browser to fall back on, so a link to another
 * site (the docs, a contact's website) opens in the browser rather than inside Spine. Links
 * within Spine, mailto: and tel: are left alone.
 */
export function useOpenOtherSitesInBrowser() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || !isStandalone()) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.protocol !== "http:" && anchor.protocol !== "https:") return;
      if (anchor.origin === window.location.origin) return;
      e.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
