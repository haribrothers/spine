import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/**
 * Same pattern as `(home)/_layout.tsx` — see that file's own doc comment
 * for the full rationale, including why `headerTintColor`/
 * `headerTitleStyle`/`headerBackButtonDisplayMode: "minimal"` are set
 * unconditionally via `screenOptions` rather than only on Android.
 */
export default function ProfileLayout() {
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
          title: "Profile",
          ...(Platform.OS === "ios" ? { headerLargeTitleEnabled: true } : { headerStyle: { backgroundColor: colors.surface } }),
        }}
      />
    </Stack>
  );
}
