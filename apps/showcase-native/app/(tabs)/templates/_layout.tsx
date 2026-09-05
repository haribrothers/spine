import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useProfileHeaderOptions } from "../../../src/lib/profile-header-items";

/**
 * Same pattern as `(home)/_layout.tsx`/`components/_layout.tsx` — see those
 * files' own doc comments, including why `headerTintColor`/
 * `headerTitleStyle`/`headerBackButtonDisplayMode: "minimal"` are set
 * unconditionally via `screenOptions` rather than only on Android, and why
 * `index`'s `headerRight` renders the shared `ProfileHeaderButton` (only on
 * `index`, not the nested detail screens, which already have a back
 * button).
 *
 * `headerOptions` (`headerStyle.backgroundColor`) is likewise applied
 * unconditionally to every non-large-title screen in this stack (both
 * platforms) — the same real, user-reported bug as `components/_layout.tsx`
 * (iOS detail screens rendering a native-default white header regardless of
 * dark mode), fixed the same way here across all three nested screens.
 */
export default function TemplatesLayout() {
  const colors = useNativeColors();
  const headerOptions = { headerStyle: { backgroundColor: colors.surface } };

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
          title: "Templates",
          ...(Platform.OS === "ios" ? { headerLargeTitleEnabled: true } : headerOptions),
          ...useProfileHeaderOptions(colors, false),
        }}
      />
      <Stack.Screen name="list-detail/index" options={headerOptions} />
      <Stack.Screen name="list-detail/[jobId]" options={headerOptions} />
      <Stack.Screen name="settings" options={headerOptions} />
    </Stack>
  );
}
