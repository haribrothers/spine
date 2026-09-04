import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/** Same pattern as `(home)/_layout.tsx`/`components/_layout.tsx` — see those files' own doc comments. */
export default function TemplatesLayout() {
  const colors = useNativeColors();
  const androidHeaderOptions = { headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.onSurface };

  return (
    <Stack>
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
