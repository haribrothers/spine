"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<string | null>(null);

/** The member's role in the active organisation, resolved server-side by the app layout. */
export const RoleProvider = RoleContext.Provider;

export function useMyRole(): string | null {
  return useContext(RoleContext);
}
