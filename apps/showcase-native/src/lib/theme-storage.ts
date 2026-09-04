import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "spine.showcase-native.theme-preference";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Persists the theme preference across reloads via `expo-secure-store`,
 * same mechanism `apps/mobile`/`apps/design-system-native` use on native.
 * Unlike `design-system-native`'s theme-storage.ts, this app is native-only
 * (no web target), so there's no `Platform.OS === "web"` branch to a
 * `localStorage` fallback — `expo-secure-store` has no web implementation
 * at all, which is fine here since web is out of scope for this app.
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
