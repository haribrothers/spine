import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@spine/ui-native";
import { persistentThemeStorage } from "../src/lib/theme-storage";
import { ProfileSheetProvider } from "../src/lib/profile-sheet-context";
import { ProfileSheet } from "../src/components/profile-sheet";

/**
 * Profile is rendered here as a plain `<ProfileSheet>` (a `<Modal>`
 * component, visibility controlled by `ProfileSheetProvider`'s context) —
 * NOT a routed `Stack.Screen`, and `(profile)` no longer exists as an
 * `app/` directory at all. See `profile-sheet-context.tsx`'s own doc
 * comment for the full rationale: the routed version (a root-level
 * sibling `Stack.Screen` alongside `(tabs)`, `presentation: "formSheet"`)
 * hit a real, severe, fully-reproduced bug — the app would boot directly
 * onto Profile instead of Home, confirmed via `usePathname()` debug
 * logging to be a genuine native rendering issue (React Navigation's own
 * state correctly reported Home as active while Profile still rendered on
 * top), and NOT fixable by clearing every cache layer tried, including a
 * full native rebuild from a completely erased simulator with zero
 * Xcode DerivedData. This pointed to a real incompatibility between
 * `NativeTabs` and a sibling modal `Stack.Screen`, not application code —
 * moving Profile out of the router entirely sidesteps that whole class of
 * bug, since a plain `<Modal>` has no interaction with `NativeTabs`' own
 * native view-controller hierarchy at all.
 */
export default function RootLayout() {
  return (
    <ThemeProvider storage={persistentThemeStorage}>
      <SafeAreaProvider>
        <ProfileSheetProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
          <ProfileSheet />
        </ProfileSheetProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
