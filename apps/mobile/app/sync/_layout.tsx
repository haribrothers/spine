import { Platform, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useNativeColors } from "@spine/ui-native";

/**
 * Sync (US-MOB-08) and Fix (US-MOB-09) in their own stack: a page sheet on
 * iOS with Close, a page on Android with the back arrow; Fix opens on top.
 */
export default function SyncLayout() {
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
      }}
    >
      <Stack.Screen
        name="index"
        options={
          ios
            ? {
                title: "Sync",
                unstable_headerRightItems: () => [{ type: "button" as const, label: "Close", icon: { type: "sfSymbol" as const, name: "xmark" as const }, accessibilityLabel: "Close", onPress: () => router.back() }],
              }
            : {
                title: "Sync",
                headerLeft: () => (
                  <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} className="mr-4 h-11 w-11 justify-center">
                    <ArrowLeft size={24} color={colors.onSurface} />
                  </Pressable>
                ),
              }
        }
      />
      <Stack.Screen name="fix/[id]" options={{ title: "Fix" }} />
    </Stack>
  );
}
