import "../global.css";
import { Platform } from "react-native";
import { Stack, ThemeProvider, useRouter } from "expo-router";
import { SpineUIProvider, useNativeColors } from "@spine/ui-native";
import { persistentThemeStorage } from "../src/lib/theme-storage";
import { SessionProvider, useSession } from "../src/lib/session/session-provider";
import { SyncProvider } from "../src/lib/outbox/sync-provider";
import { profileScreenOptions } from "../src/features/profile/profile-screen";
import { useNavigationTheme } from "../src/lib/navigation-theme";

/**
 * Which part of the app is reachable: Sign in when signed out, the tabs and
 * Profile when signed in, and only "Update Spine to keep going" after the
 * server answered 426 (US-MOB-10). `Stack.Protected` moves to the first
 * reachable screen whenever the session changes, so signing out — or a
 * removed membership (US-MOB-02) — lands on Sign in.
 */
function RootStack() {
  const { state, updateRequired } = useSession();
  const colors = useNativeColors();
  const router = useRouter();
  const navigationTheme = useNavigationTheme();
  if (state.status === "loading") return null;
  const signedIn = state.status === "signedIn";

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, headerTintColor: colors.onSurface, headerTitleStyle: { color: colors.onSurface } }}>
        <Stack.Protected guard={updateRequired}>
          <Stack.Screen name="update-required" />
        </Stack.Protected>
        <Stack.Protected guard={!updateRequired && signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" options={profileScreenOptions(Platform.OS, colors, () => router.back())} />
        <Stack.Screen name="sync" options={{ presentation: Platform.OS === "ios" ? "modal" : "card", headerShown: false }} />
        <Stack.Screen name="camera" options={{ presentation: "fullScreenModal", headerShown: false, animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="milestone-complete"
          options={{ presentation: "formSheet", sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: Platform.OS === "ios", headerStyle: { backgroundColor: colors.surface } }}
        />
        <Stack.Screen name="quote" options={{ presentation: "fullScreenModal", headerShown: false }} />
        <Stack.Screen name="expense-new" options={{ presentation: Platform.OS === "ios" ? "modal" : "card", headerShown: true, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: Platform.OS === "ios" }} />
        </Stack.Protected>
        <Stack.Protected guard={!updateRequired && !signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <SessionProvider>
        <SyncProvider>
          <RootStack />
        </SyncProvider>
      </SessionProvider>
    </SpineUIProvider>
  );
}
