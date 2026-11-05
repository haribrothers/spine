import { Platform, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useNativeColors } from "@spine/ui-native";
import { useT } from "../../src/lib/i18n";

/**
 * Sync (US-MOB-08) and Fix (US-MOB-09) in their own stack: a page sheet on
 * iOS with Close, a page on Android with the back arrow; Fix opens on top.
 */
export default function SyncLayout() {
  const t = useT();
  const router = useRouter();
  const colors = useNativeColors();
  const ios = Platform.OS === "ios";
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor: colors.background },
        // US-MOB-20: Android's top app bar is flat.
        headerShadowVisible: ios,
      }}
    >
      <Stack.Screen
        name="index"
        options={
          ios
            ? {
                title: t("mobileApp.sync.title"),
                unstable_headerRightItems: () => [{ type: "button" as const, label: t("mobileApp.common.close"), icon: { type: "sfSymbol" as const, name: "xmark" as const }, accessibilityLabel: t("mobileApp.common.close"), onPress: () => router.back() }],
              }
            : {
                title: t("mobileApp.sync.title"),
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("mobileApp.common.back")} hitSlop={10} className="mr-4 h-11 w-11 justify-center">
                    <ArrowLeft size={24} color={colors.onSurface} />
                  </Pressable>
                ),
              }
        }
      />
      <Stack.Screen name="fix/[id]" options={{ title: t("mobileApp.fix.title") }} />
    </Stack>
  );
}
