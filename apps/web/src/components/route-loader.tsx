"use client";

import { PageLoader } from "@spine/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

/**
 * Shows a full-screen PageLoader while a route transition is under way,
 * for any navigation slow enough to notice (a server component doing a
 * DB/API round trip before the new page can paint) — fast ones resolve
 * before the delay elapses and never show anything, avoiding a flash on
 * every click.
 *
 * Next.js 15.1 (this app's version) has no built-in pending-navigation
 * hook (`useLinkStatus` landed in 15.3), so this listens at the document
 * level for clicks on same-origin, different-path `<a>` tags — which
 * covers both `next/link` and `router.push()` triggered from a click
 * handler, the two navigation styles used across this app — and clears
 * itself once `usePathname`/`useSearchParams` reflect the new route.
 */
export function RouteLoader() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    function clearPendingTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleClick(event: MouseEvent) {
      // Note: next/link's own handler calls preventDefault() to perform a
      // client-side transition, so event.defaultPrevented is already true
      // by the time this native document-level listener runs — it is NOT
      // a signal to skip the click here.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      startedRef.current = true;
      clearPendingTimeout();
      // A short delay avoids flashing the loader for the common case where
      // the next route is already prefetched and paints almost instantly.
      timeoutRef.current = setTimeout(() => setPending(true), 150);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      clearPendingTimeout();
    };
  }, []);

  useEffect(() => {
    // Pathname or search params changed -> the navigation that was pending
    // has committed, so drop the loader (and cancel a not-yet-fired delay
    // timer from a navigation that resolved before it could show).
    if (!startedRef.current) return;
    startedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPending(false);
  }, [pathname, searchParams]);

  if (!pending) return null;
  return <PageLoader fullScreen label={t("common.routeLoader.loading")} />;
}
