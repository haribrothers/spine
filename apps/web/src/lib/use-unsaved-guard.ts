"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * US-QUO-35, US-INV-34 — a builder's unsaved changes: "Unsaved changes"
 * once the person changes something, and "Leave without saving?" before
 * Cancel, a link elsewhere in the app, Back or closing the tab loses them.
 *
 * Fields can settle their own values as they load (a picker resolving its
 * option, say), so only a change after the person has pressed or typed in
 * the form counts: wrap setters in `touch` and spread `interactionProps`
 * on the form.
 */
export function useUnsavedGuard(historyKey: string) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [leaveTo, setLeaveTo] = useState<string | "back" | null>(null);
  const interacted = useRef(false);
  const touch = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (interacted.current) setDirty(true);
    fn(...args);
  };
  const interactionProps = {
    onPointerDownCapture: () => (interacted.current = true),
    onKeyDownCapture: () => (interacted.current = true),
    onInputCapture: () => (interacted.current = true),
  };

  // Closing or reloading the tab asks the browser to confirm.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // A link elsewhere in the app asks first.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      // Stopped here, before the link (and the route loader) see the click.
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(anchor.pathname + anchor.search);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Back asks first.
  useEffect(() => {
    if (!dirty) return;
    window.history.pushState({ [historyKey]: true }, "", window.location.href);
    function onPopState() {
      if (!dirtyRef.current) return;
      window.history.pushState({ [historyKey]: true }, "", window.location.href);
      setLeaveTo("back");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty, historyKey]);

  /** After a save: nothing is unsaved any more. */
  function markSaved() {
    setDirty(false);
    dirtyRef.current = false;
  }

  /** "Leave" in the dialog: go where the person was heading. */
  function leave() {
    const target = leaveTo;
    markSaved();
    setLeaveTo(null);
    if (target === "back") window.history.go(-2);
    else if (target) router.push(target);
  }

  return { dirty, touch, interactionProps, markSaved, leaveTo, setLeaveTo, leave };
}
