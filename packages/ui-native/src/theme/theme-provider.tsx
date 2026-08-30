import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { colorScheme as nativeWindColorScheme, useColorScheme } from "nativewind";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Light/dark/system theming, matching web's exact three-state precedence
 * (`packages/config/tailwind-preset.css` + `next-themes`: explicit choice
 * wins, else `prefers-color-scheme`/`Appearance`) — see the Phase 5 plan's
 * own "Theming — dark/light/system, matching web exactly" section for why
 * this is required, not optional.
 *
 * NativeWind v4's `colorScheme.set("light" | "dark" | "system")` already
 * implements this exact precedence natively (it tracks `Appearance`
 * internally for the "system" case), so this provider is a thin layer on
 * top: it persists the user's explicit choice via the given `storage`
 * adapter (the consuming app supplies `expo-secure-store`-backed
 * read/write — this package stays storage-agnostic so it has no direct
 * dependency on a specific persistence mechanism) and restores it BEFORE
 * first paint is a consuming-app concern (call `getPreference` from
 * `storage` synchronously/eagerly at app boot, before rendering
 * `ThemeProvider`, to avoid a flash of the wrong theme — this provider
 * itself doesn't gate rendering on the async storage read completing,
 * since packages/ui-native has no opinion about the app's own splash/boot
 * sequence).
 */
export interface ThemeStorage {
  getPreference: () => Promise<ThemePreference | null>;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

interface ThemeContextValue {
  preference: ThemePreference;
  /** The actually-resolved mode right now ("system" never appears here — it's always resolved to "light" or "dark"). */
  resolvedMode: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ storage, children }: { storage: ThemeStorage; children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    storage.getPreference().then((stored) => {
      if (cancelled || !stored) return;
      setPreferenceState(stored);
      nativeWindColorScheme.set(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      nativeWindColorScheme.set(next);
      void storage.setPreference(next);
    },
    [storage],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedMode: colorScheme ?? "light", setPreference }),
    [preference, colorScheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
