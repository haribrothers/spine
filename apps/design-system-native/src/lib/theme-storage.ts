import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "spine.design-system-native.theme-preference";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Persists the theme preference across reloads — this app's earlier
 * in-memory-only storage (reset on every reload) was a deliberate initial
 * scoping choice, but shipped as a real reported friction point once
 * people actually used the toggle day to day. `expo-secure-store` has no
 * web implementation at all (its `.web.ts` is an empty stub, confirmed by
 * reading the installed package — unlike `apps/mobile`'s theme-storage.ts,
 * which never runs on web), so this branches: `localStorage` on web (a
 * theme preference is not remotely sensitive, so a bare synchronous
 * browser API is fine here — no need for SecureStore's native-only
 * encryption story), `expo-secure-store` on native for consistency with
 * `apps/mobile`'s own choice of storage mechanism.
 */
export const persistentThemeStorage: ThemeStorage = {
  async getPreference() {
    if (Platform.OS === "web") {
      const value = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      return isValidPreference(value) ? value : null;
    }
    const value = await SecureStore.getItemAsync(KEY);
    return isValidPreference(value) ? value : null;
  },
  async setPreference(preference) {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, preference);
      return;
    }
    await SecureStore.setItemAsync(KEY, preference);
  },
};
