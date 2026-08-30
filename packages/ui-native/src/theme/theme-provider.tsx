import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
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
 *
 * WEB-ONLY WORKAROUND, verified against a real bug in the installed
 * `react-native-css-interop@0.2.6`/`nativewind@4.2.6` pair: on web,
 * `colorScheme.set("system")`'s implementation ALWAYS removes the `.dark`
 * class from `document.documentElement` — it never actually checks
 * `prefers-color-scheme` for the "system" case (confirmed by reading
 * `react-native-css-interop`'s own `dist/runtime/web/color-scheme.js`:
 * its `set()` only special-cases `value === "dark"` to add the class;
 * every other value, including "system", falls into an unconditional
 * `classList.remove(...)`). Reproduced live with a headless-browser test
 * forcing `prefers-color-scheme: dark`: `.set("system")` still left the
 * page in light mode. `applyPreference` below works around this ONLY on
 * web by resolving "system" to the real `matchMedia` result and calling
 * `.set("dark" | "light")` directly instead of `.set("system")`, with a
 * live `change` listener kept while the preference stays "system" so an
 * OS-level theme switch is still picked up without a page reload. Native
 * is unaffected by this bug (its `Appearance`-based path doesn't share
 * this code) and keeps calling `.set("system")` directly.
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

function applyPreference(preference: ThemePreference): (() => void) | undefined {
  if (Platform.OS !== "web" || preference !== "system") {
    nativeWindColorScheme.set(preference);
    return undefined;
  }

  const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;
  if (!media) {
    nativeWindColorScheme.set("light");
    return undefined;
  }

  const applySystemNow = () => nativeWindColorScheme.set(media.matches ? "dark" : "light");
  applySystemNow();
  media.addEventListener("change", applySystemNow);
  return () => media.removeEventListener("change", applySystemNow);
}

export function ThemeProvider({ storage, children }: { storage: ThemeStorage; children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const { colorScheme } = useColorScheme();
  const cleanupSystemListenerRef = useRef<(() => void) | undefined>(undefined);

  const runApplyPreference = useCallback((next: ThemePreference) => {
    cleanupSystemListenerRef.current?.();
    cleanupSystemListenerRef.current = applyPreference(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    storage.getPreference().then((stored) => {
      if (cancelled) return;
      // Apply unconditionally, even with no stored preference (the default
      // "system") — NativeWind's own boot-time default resolves "system"
      // incorrectly on web (see this file's own doc comment on the
      // `set("system")` bug), so relying on it rather than explicitly
      // (re-)applying here left a fresh session stuck in light mode
      // regardless of the real OS/browser preference.
      const effective = stored ?? "system";
      setPreferenceState(effective);
      runApplyPreference(effective);
    });
    return () => {
      cancelled = true;
      cleanupSystemListenerRef.current?.();
    };
  }, [storage, runApplyPreference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      runApplyPreference(next);
      void storage.setPreference(next);
    },
    [storage, runApplyPreference],
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
