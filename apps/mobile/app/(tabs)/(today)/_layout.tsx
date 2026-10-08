import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useTabHeaderOptions } from "../../../src/components/header-items";
import { SyncPill } from "../../../src/components/sync-pill";
import { BellButton } from "../../../src/components/bell-button";

/**
 * The Today tab's own native stack: a large title on iOS; the sync pill,
 * the bell and the avatar in the header (US-MOB-03, D-197). Notifications
 * and a meeting open on this stack (US-MOB-22).
 */
export default function TodayLayout() {
  const colors = useNativeColors();
  const tabHeader = useTabHeaderOptions("Today", Platform.OS, { left: <SyncPill />, right: [<BellButton key="bell" />] });
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
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="meetings/[id]" options={{ title: "Meeting" }} />
    </Stack>
  );
}
