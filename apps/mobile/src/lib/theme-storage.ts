import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "spine.mobile.theme-preference";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * `expo-secure-store`-backed implementation of @spine/ui-native's
 * `ThemeStorage` contract. This app is native-only (no web target) — see
 * apps/design-system-native/src/lib/theme-storage.ts for the pattern with a
 * `localStorage` web fallback if this app later adds one.
 */
export const persistentThemeStorage: ThemeStorage = {
  async getPreference() {
    const value = await SecureStore.getItemAsync(KEY);
    return isValidPreference(value) ? value : null;
  },
  async setPreference(preference) {
    await SecureStore.setItemAsync(KEY, preference);
  },
};
