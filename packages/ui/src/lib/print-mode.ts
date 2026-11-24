"use client";

import { useEffect, useState } from "react";

const PRINT_START = "spine:print-start";

/**
 * US-RPT-34 — true while a page is being printed from its "Print" action,
 * so paged tables render every row. `printPage()` turns it on, waits for
 * the rows to render, then opens the browser's print dialog; `afterprint`
 * turns it off. (Printing with the browser's own shortcut prints the page
 * as it stands.)
 */
export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const start = () => setPrinting(true);
    const stop = () => setPrinting(false);
    window.addEventListener(PRINT_START, start);
    window.addEventListener("afterprint", stop);
    return () => {
      window.removeEventListener(PRINT_START, start);
      window.removeEventListener("afterprint", stop);
    };
  }, []);
  return printing;
}

/** Shows every table row, then opens the print dialog once they've rendered. */
export function printPage(): void {
  window.dispatchEvent(new Event(PRINT_START));
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
}
