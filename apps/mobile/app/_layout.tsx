import "../global.css";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SpineUIProvider, useNativeColors } from "@spine/ui-native";
import { persistentThemeStorage } from "../src/lib/theme-storage";
import { SessionProvider, useSession } from "../src/lib/session/session-provider";
import { profileScreenOptions } from "../src/features/profile/profile-screen";

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
  if (state.status === "loading") return null;
  const signedIn = state.status === "signedIn";

  return (
    <Stack screenOptions={{ headerShown: false, headerTintColor: colors.onSurface, headerTitleStyle: { color: colors.onSurface } }}>
      <Stack.Protected guard={updateRequired}>
        <Stack.Screen name="update-required" />
      </Stack.Protected>
      <Stack.Protected guard={!updateRequired && signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={profileScreenOptions(Platform.OS, colors, () => router.back())} />
      </Stack.Protected>
      <Stack.Protected guard={!updateRequired && !signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <SessionProvider>
        <RootStack />
      </SessionProvider>
    </SpineUIProvider>
  );
}
