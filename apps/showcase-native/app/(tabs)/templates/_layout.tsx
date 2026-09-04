import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/**
 * Same pattern as `(home)/_layout.tsx`/`components/_layout.tsx` — see those
 * files' own doc comments, including why `headerTintColor`/
 * `headerTitleStyle`/`headerBackButtonDisplayMode: "minimal"` are set
 * unconditionally via `screenOptions` rather than only on Android.
 */
export default function TemplatesLayout() {
  const colors = useNativeColors();
  const androidHeaderOptions = { headerStyle: { backgroundColor: colors.surface } };

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
          ...(Platform.OS === "ios" ? { headerLargeTitleEnabled: true } : androidHeaderOptions),
        }}
      />
      <Stack.Screen name="list-detail/index" options={Platform.OS === "android" ? androidHeaderOptions : undefined} />
      <Stack.Screen name="list-detail/[jobId]" options={Platform.OS === "android" ? androidHeaderOptions : undefined} />
      <Stack.Screen name="settings" options={Platform.OS === "android" ? androidHeaderOptions : undefined} />
    </Stack>
  );
}
