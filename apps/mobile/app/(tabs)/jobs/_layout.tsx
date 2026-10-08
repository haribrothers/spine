import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useTabHeaderOptions } from "../../../src/components/header-items";

/** The Jobs tab's own native stack: a large title on iOS, the avatar on the right (D-197). */
export default function JobsLayout() {
  const colors = useNativeColors();
  const tabHeader = useTabHeaderOptions("Jobs");
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        ...(Platform.OS === "android" ? { headerStyle: { backgroundColor: colors.background } } : {}),
      }}
    >
      <Stack.Screen name="index" options={tabHeader} />
    </Stack>
  );
}
