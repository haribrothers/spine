import type { ThemeStorage } from "@spine/ui-native";

/**
 * In-memory `ThemeStorage` for this docs app — unlike apps/mobile there's no
 * real user session to persist a preference across, so a SecureStore/AsyncStorage
 * dependency isn't worth adding; the light/dark toggle just resets on reload.
 */
let preference: Awaited<ReturnType<ThemeStorage["getPreference"]>> = null;

export const inMemoryThemeStorage: ThemeStorage = {
  async getPreference() {
    return preference;
  },
  async setPreference(next) {
    preference = next;
  },
};
