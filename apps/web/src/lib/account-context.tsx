"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { DigestDays } from "@spine/shared";
import { apiClient } from "./api-client";

/** `GET /users/me` — the signed-in person's own account (US-AUTH-16 to US-AUTH-19). */
export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
  themePreference: "system" | "light" | "dark" | string;
  meetingReminderLeadMinutes: number | null;
  digestEnabled: boolean;
  digestTime: string;
  digestDays: DigestDays;
  orgDefaults: { meetingReminderLeadMinutes: number; timeZone: string };
}

interface AccountState {
  /** False outside the app layout (onboarding), where Settings leaves Your account out. */
  available: boolean;
  account: Account | null;
  setAccount: (next: Account) => void;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

/** The tab already applied this person's saved theme (once per sign-in, US-AUTH-16). */
const THEME_APPLIED_KEY = "spine.theme.applied";

/**
 * US-AUTH-16 (D-236) — loads the person once for the sidebar, the user menu
 * and Settings › Your account, and applies their saved theme when a tab
 * starts, so it follows them to every device. After that the user menu owns
 * the theme (it saves as it switches).
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  // Read through a ref: the load runs once, whatever next-themes hands back on later renders.
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;
  const [account, setAccount] = useState<Account | null>(null);

  const refresh = useCallback(async () => {
    const next = await apiClient.get<Account>("/users/me");
    setAccount(next);
  }, []);

  useEffect(() => {
    apiClient
      .get<Account>("/users/me")
      .then((next) => {
        setAccount(next);
        let applied: string | null = null;
        try {
          applied = window.sessionStorage.getItem(THEME_APPLIED_KEY);
        } catch {
          // Storage blocked: apply every time.
        }
        if (applied !== next.id) {
          setThemeRef.current(next.themePreference);
          try {
            window.sessionStorage.setItem(THEME_APPLIED_KEY, next.id);
          } catch {
            // Nothing to remember it in.
          }
        }
      })
      .catch(() => {});
  }, []);

  return <AccountContext.Provider value={{ available: true, account, setAccount, refresh }}>{children}</AccountContext.Provider>;
}

/** The signed-in person; `account` is null until loaded (or outside the app layout). */
export function useAccount(): AccountState {
  return useContext(AccountContext) ?? { available: false, account: null, setAccount: () => {}, refresh: async () => {} };
}
