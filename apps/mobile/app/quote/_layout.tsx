import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/**
 * Presenting a quote (US-MOB-16 to US-MOB-18): the quote, then Accept and
 * Quote accepted pushed on top, and Decline as a sheet over it — all in
 * one full-screen modal over the job.
 */
export default function QuoteLayout() {
  const colors = useNativeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[id]/index" />
      {/* Signing sweeps across the screen: the swipe-back gesture would take the customer's stroke. The back button stays. */}
      <Stack.Screen name="[id]/accept" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="[id]/accepted" options={{ gestureEnabled: false, animation: "fade" }} />
      <Stack.Screen
        name="[id]/decline"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [Platform.OS === "ios" ? 0.62 : 0.66],
          sheetGrabberVisible: true,
          headerShown: Platform.OS === "ios",
          title: "Decline quote",
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.onSurface },
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </Stack>
  );
}
