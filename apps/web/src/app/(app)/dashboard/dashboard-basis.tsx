"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
import type { DashboardBasis } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";

const BasisContext = createContext<{ basis: DashboardBasis; setBasis: (basis: DashboardBasis) => void; /** US-DASH-27: false until the member's choice is known, so cards load once. */ ready: boolean }>({ basis: "accrual", setBasis: () => {}, ready: true });

/**
 * US-DASH-26 (D-138, D-179) — the dashboard's "Accrual / Cash" choice,
 * kept on the member (with their layout) so it follows them to any
 * device. "Profit this month" and the money chart read it.
 */
export function DashboardBasisProvider({ children }: { children: React.ReactNode }) {
  const [basis, setBasisState] = useState<DashboardBasis>("accrual");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    apiClient
      .get<{ basis: DashboardBasis }>("/users/me/dashboard-basis")
      .then((res) => setBasisState(res.basis))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const setBasis = (next: DashboardBasis) => {
    setBasisState(next);
    void apiClient.put("/users/me/dashboard-basis", { basis: next }).catch(() => {});
  };
  return <BasisContext.Provider value={{ basis, setBasis, ready }}>{children}</BasisContext.Provider>;
}

export function useDashboardBasis() {
  return useContext(BasisContext);
}

/** "Accrual | Cash" in the dashboard header. */
export function BasisSwitch() {
  const { basis, setBasis } = useDashboardBasis();
  return (
    <ToggleGroup type="single" value={basis} onValueChange={(v) => v && setBasis(v as DashboardBasis)} aria-label="Profit basis" className="rounded-md border border-border p-0.5">
      <ToggleGroupItem value="accrual" className="px-3">
        Accrual
      </ToggleGroupItem>
      <ToggleGroupItem value="cash" className="px-3">
        Cash
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
