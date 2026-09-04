import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/** Same pattern as `(home)/_layout.tsx` — see that file's own doc comment for the full rationale. */
export default function ProfileLayout() {
  const colors = useNativeColors();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Profile",
          ...(Platform.OS === "ios"
            ? { headerLargeTitleEnabled: true }
            : {
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.onSurface,
              }),
        }}
      />
    </Stack>
  );
}
