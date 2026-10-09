import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useTabHeaderOptions } from "../../../src/components/header-items";
import { androidHeaderOptions } from "../../../src/lib/android-header";

/** A job opened from Today, Search or a notification still has the list under it. */
export const unstable_settings = { initialRouteName: "index" };

/** The Jobs tab's own native stack: the list (large title, avatar), a job, its photos (US-MOB-04, US-MOB-05). */
export default function JobsLayout() {
  const colors = useNativeColors();
  const tabHeader = useTabHeaderOptions("Jobs");
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        ...androidHeaderOptions(colors),
      }}
    >
      <Stack.Screen name="index" options={tabHeader} />
      <Stack.Screen name="[id]/index" options={{ title: "" }} />
      <Stack.Screen name="[id]/photos" options={{ title: "Photos" }} />
    </Stack>
  );
}
