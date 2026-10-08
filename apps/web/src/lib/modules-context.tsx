"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_MODULES, type ModuleKey, type ModuleSettings } from "@spine/shared";
import { apiClient } from "./api-client";

type ModulesState = {
  /** `null` while the first fetch is in flight. */
  modules: ModuleSettings | null;
  /** Re-reads them, e.g. after Settings › Modules saves. */
  refresh: () => void;
};

const ModulesContext = createContext<ModulesState>({ modules: null, refresh: () => {} });

/**
 * US-SET-24 (D-154) — which optional modules are on, read once per session
 * (`GET /org/modules`) and shared with the whole app, like capabilities.
 * The sidebar, pages, dashboard, settings panes, Teams and pickers hide
 * what a switched-off module owns, from the same map the API guard uses
 * (`packages/shared/src/modules.ts`). UX only: the API refuses on its own.
 */
export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<ModuleSettings | null>(null);
  const refresh = useCallback(() => {
    apiClient
      .get<ModuleSettings>("/org/modules")
      .then(setModules)
      // Before an organisation exists (mid-onboarding) everything is on.
      .catch(() => setModules(DEFAULT_MODULES));
  }, []);
  useEffect(refresh, [refresh]);
  return <ModulesContext.Provider value={{ modules, refresh }}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModulesState {
  return useContext(ModulesContext);
}

/** Whether a module is on — false while unknown, so nothing of it flashes up and vanishes. */
export function useModule(key: ModuleKey): boolean {
  return useContext(ModulesContext).modules?.[key] === true;
}
