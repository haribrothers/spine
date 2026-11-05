import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useTabHeaderOptions } from "../../../src/components/header-items";
import { androidHeaderOptions } from "../../../src/lib/android-header";
import { useT } from "../../../src/lib/i18n";

/** The Search tab's own native stack: a large title on iOS, the avatar on the right (D-197). */
export default function SearchLayout() {
  const t = useT();
  const colors = useNativeColors();
  const tabHeader = useTabHeaderOptions(t("mobileApp.tabs.search"));
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        ...androidHeaderOptions(colors),
      }}
    >
      {/* Android draws Material's search bar itself, with the avatar inside it (US-MOB-20). */}
      <Stack.Screen name="index" options={Platform.OS === "android" ? { headerShown: false } : tabHeader} />
    </Stack>
  );
}
