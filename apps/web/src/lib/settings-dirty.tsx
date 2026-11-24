"use client";

import { createContext, useContext } from "react";

/**
 * US-SET-33 (D-236) — Settings knows a pane has unsaved changes when someone
 * types or picks something in it; a pane says it saved with `markSaved()`
 * (`SavedToast` does it for most panes).
 */
export const SettingsDirtyContext = createContext<{ markSaved: () => void }>({ markSaved: () => {} });

export function useSettingsSaved(): () => void {
  return useContext(SettingsDirtyContext).markSaved;
}
