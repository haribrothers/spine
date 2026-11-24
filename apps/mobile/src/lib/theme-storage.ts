import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "spine.mobile.theme-preference";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * `expo-secure-store`-backed implementation of @spine/ui-native's
 * `ThemeStorage` contract. This app is native-only (no web target); if it
 * ever gets one, `expo-secure-store` has no web implementation, so branch on
 * `Platform.OS` and use `localStorage` there.
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
