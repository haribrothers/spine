import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useProfileHeaderOptions } from "../../../src/lib/profile-header-items";

/**
 * Same pattern as `(home)/_layout.tsx` — see that file's own doc comment
 * for the full rationale (`headerLargeTitleEnabled` iOS-only,
 * `contentInsetAdjustmentBehavior="automatic"` required on each screen's
 * own ScrollView, `headerTintColor`/`headerTitleStyle`/
 * `headerBackButtonDisplayMode: "minimal"` set unconditionally via
 * `screenOptions` for both platforms). The `[slug]` detail screen sets its
 * own `title` via `Stack.Screen options` at render time (see `[slug].tsx`).
 *
 * `[slug]`'s `headerStyle.backgroundColor` is set UNCONDITIONALLY (both
 * platforms) — a real, user-reported bug: the previous version only set it
 * on Android, so on iOS every detail screen's header rendered at the
 * native default (white) background regardless of the app's own dark mode.
 * Same class of gap as the `headerTintColor`/`headerTitleStyle` fix above,
 * just missed on this one nested screen at the time.
 *
 * `index`'s `headerRight` renders `ProfileHeaderButton` (the shared avatar
 * that opens the Profile `<Modal>`, see `(home)/_layout.tsx`'s own doc
 * comment for the full rationale) — only on `index`, not `[slug]`, since
 * the detail screen already has its own back button and doesn't need a
 * second header action competing for space.
 */
export default function ComponentsLayout() {
  const colors = useNativeColors();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Components",
          ...(Platform.OS === "ios" ? { headerLargeTitleEnabled: true } : { headerStyle: { backgroundColor: colors.surface } }),
          ...useProfileHeaderOptions(colors, false),
        }}
      />
      <Stack.Screen name="[slug]" options={{ headerStyle: { backgroundColor: colors.surface } }} />
    </Stack>
  );
}
