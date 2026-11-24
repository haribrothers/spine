"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

const PrintRangeContext = createContext<{ range: string | null; setRange: (range: string | null) => void } | null>(null);

/**
 * US-RPT-34 — the line a printed report carries under its title: the
 * business name and the range or date. Screens don't show it; the report's
 * Export menu tells it the range (from the same filters the export uses).
 */
export function PrintRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState<string | null>(null);
  return <PrintRangeContext.Provider value={{ range, setRange }}>{children}</PrintRangeContext.Provider>;
}

/** Sets the printed range while the calling component is on screen. */
export function usePrintRange(range: string | null) {
  const setRange = useContext(PrintRangeContext)?.setRange;
  useEffect(() => {
    setRange?.(range);
    return () => setRange?.(null);
  }, [range, setRange]);
}

/** The range the report on screen covers ("Jul 1 – Sep 30, 2026"), or null. */
export function useCurrentPrintRange(): string | null {
  return useContext(PrintRangeContext)?.range ?? null;
}

/** "Riverstone Builders · Jul 1 – Sep 30, 2026", in print only. */
export function PrintHeader() {
  const range = useContext(PrintRangeContext)?.range ?? null;
  const [business, setBusiness] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<{ value: { name?: string } | null }>("/org/settings/business_profile")
      .then((res) => setBusiness(res.value?.name?.trim() || null))
      .catch(() => {});
  }, []);
  const text = [business, range].filter(Boolean).join(" · ");
  if (!text) return null;
  return (
    <p className="-mt-4 mb-4 hidden text-[14px] print:block" data-testid="print-header">
      {text}
    </p>
  );
}
