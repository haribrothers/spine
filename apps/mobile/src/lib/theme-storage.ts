import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "spine.theme-preference";

/**
 * `expo-secure-store`-backed implementation of @spine/ui-native's
 * `ThemeStorage` contract — the theme preference isn't sensitive, but
 * SecureStore is already the auth-flow's chosen persistence mechanism
 * (Phase 5 plan) and using one storage API for both avoids introducing a
 * second dependency (AsyncStorage) for a single small value.
 */
export const secureStoreThemeStorage: ThemeStorage = {
  async getPreference() {
    const value = await SecureStore.getItemAsync(KEY);
    return value === "light" || value === "dark" || value === "system" ? (value as ThemePreference) : null;
  },
  async setPreference(preference) {
    await SecureStore.setItemAsync(KEY, preference);
  },
};
