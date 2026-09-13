import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useNativeColors } from "@spine/ui-native";
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
 *
 * **`job-edit/[jobId]` is a DIFFERENT case from Profile — a real routed
 * sibling `Stack.Screen`, not a bare `<Modal>` — and this is intentional,
 * not an oversight.** It's an ordinary, default-presentation (`card`) push,
 * NOT a modal — the bug above was specifically about
 * `presentation: "formSheet"`. Moving `job-edit` here (out of
 * `(tabs)/templates/`, where it lived until it was reported that its
 * sticky Cancel/Save footer rendered underneath the Templates tab's own
 * always-visible native tab bar) is the WhatsApp-chat-screen pattern: a
 * screen that isn't a descendant of `NativeTabs` at all never has the tab
 * bar mounted over it, no per-screen "hide the tab bar" flag needed (none
 * exists on `NativeTabs` in this version anyway). Verified on-device before
 * landing this — no repeat of the Profile boot-order bug. If a similar bug
 * ever resurfaces here, suspect a presentation-mode change first, not this
 * screen's placement outside the tabs group.
 */
function RootStack() {
  const colors = useNativeColors();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="job-edit/[jobId]"
        options={{
          headerShown: true,
          headerTintColor: colors.onSurface,
          headerTitleStyle: { color: colors.onSurface },
          headerBackButtonDisplayMode: "minimal",
          headerLargeTitleEnabled: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider storage={persistentThemeStorage}>
      <SafeAreaProvider>
        <ProfileSheetProvider>
          <RootStack />
          <ProfileSheet />
        </ProfileSheetProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
