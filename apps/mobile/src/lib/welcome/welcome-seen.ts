import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Storage from "expo-sqlite/kv-store";

/**
 * US-MOB-26 — whether this install has seen Welcome. Kept in the app's own
 * key-value store (not the keychain, which iOS keeps after the app is
 * deleted), so a fresh install shows Welcome; once set it stays set, so
 * signing out or updating never shows it again.
 */
const KEY = "spine.mobile.welcome-seen";

/** Welcome is the first screen only for a signed-out phone that hasn't seen it, and never while an update is required. */
export function showsWelcome({ signedIn, updateRequired, welcomeSeen }: { signedIn: boolean; updateRequired: boolean; welcomeSeen: boolean }): boolean {
  return !updateRequired && !signedIn && !welcomeSeen;
}

export async function getWelcomeSeen(): Promise<boolean> {
  try {
    return (await Storage.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setWelcomeSeen(): Promise<void> {
  await Storage.setItemAsync(KEY, "1");
}

/** `seen` is null until the flag has been read. */
export function useWelcomeSeen(): { seen: boolean | null; markSeen: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void getWelcomeSeen().then((value) => live && setSeen(value));
    return () => {
      live = false;
    };
  }, []);
  const markSeen = useCallback(() => {
    setSeen(true);
    void setWelcomeSeen();
  }, []);
  return { seen, markSeen };
}

const WelcomeContext = createContext<{ seen: boolean | null; markSeen: () => void }>({ seen: true, markSeen: () => {} });

/** Reads the flag once for the whole app: the root layout decides whether Welcome is reachable, and Welcome sets it. */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  return createElement(WelcomeContext.Provider, { value: useWelcomeSeen() }, children);
}

export function useWelcome(): { seen: boolean | null; markSeen: () => void } {
  return useContext(WelcomeContext);
}
