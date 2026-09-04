import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/**
 * Same pattern as `(home)/_layout.tsx` — see that file's own doc comment
 * for the full rationale (`headerLargeTitleEnabled` iOS-only,
 * `contentInsetAdjustmentBehavior="automatic"` required on each screen's
 * own ScrollView, Android gets a themed solid header). The `[slug]` detail
 * screen sets its own `title` via `Stack.Screen options` at render time
 * (see `[slug].tsx`), so no `name="[slug]"` override is declared here.
 */
export default function ComponentsLayout() {
  const colors = useNativeColors();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Components",
          ...(Platform.OS === "ios"
            ? { headerLargeTitleEnabled: true }
            : {
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.onSurface,
              }),
        }}
      />
      <Stack.Screen
        name="[slug]"
        options={
          Platform.OS === "android"
            ? {
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.onSurface,
              }
            : undefined
        }
      />
    </Stack>
  );
}
