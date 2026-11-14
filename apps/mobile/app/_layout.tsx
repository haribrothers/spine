import "../global.css";
// First, so the splash is held before anything else loads (US-MOB-25).
import { hideSplash } from "../src/lib/splash";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { Stack, ThemeProvider, useRouter } from "expo-router";
import { SpineUIProvider, useNativeColors } from "@spine/ui-native";
import { persistentThemeStorage } from "../src/lib/theme-storage";
import { SessionProvider, useSession } from "../src/lib/session/session-provider";
import { SyncProvider } from "../src/lib/outbox/sync-provider";
import { profileScreenOptions } from "../src/features/profile/profile-screen";
import { useNavigationTheme } from "../src/lib/navigation-theme";
import { showsWelcome, useWelcome, WelcomeProvider } from "../src/lib/welcome/welcome-seen";

// Welcome and Sign in read Reduce Motion themselves and show their still
// version (D-204), so Reanimated's development notice adds nothing.
LogBox.ignoreLogs(["[Reanimated] Reduced motion setting is enabled on this device"]);

/**
 * Which part of the app is reachable: Sign in when signed out, the tabs and
 * Profile when signed in, and only "Update Spine to keep going" after the
 * server answered 426 (US-MOB-10). `Stack.Protected` moves to the first
 * reachable screen whenever the session changes, so signing out — or a
 * removed membership (US-MOB-02) — lands on Sign in. On the first launch,
 * Welcome comes before Sign in (US-MOB-26).
 *
 * The splash stays up until the session and the Welcome flag are known and
 * the first screen has laid out (US-MOB-25); Welcome hides it itself so its
 * mark can take over from the splash's.
 */
function RootStack() {
  const { state, updateRequired } = useSession();
  const colors = useNativeColors();
  const router = useRouter();
  const navigationTheme = useNavigationTheme();
  const { seen: welcomeSeen, markSeen } = useWelcome();
  const signedIn = state.status === "signedIn";
  // US-TEAM-24: an Owner set this password — only "Choose your own password" until they do.
  const mustChoose = state.status === "signedIn" && state.session.member.mustChangePassword === true;

  // Someone already signed in when this version arrives never needs Welcome.
  useEffect(() => {
    if (signedIn && welcomeSeen === false) markSeen();
  }, [signedIn, welcomeSeen, markSeen]);

  if (state.status === "loading" || welcomeSeen === null) return null;
  const welcome = showsWelcome({ signedIn, updateRequired, welcomeSeen });

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={{ flex: 1 }} onLayout={welcome ? undefined : hideSplash}>
        <Stack screenOptions={{ headerShown: false, headerTintColor: colors.onSurface, headerTitleStyle: { color: colors.onSurface } }}>
          <Stack.Protected guard={updateRequired}>
            <Stack.Screen name="update-required" />
          </Stack.Protected>
          <Stack.Protected guard={!updateRequired && mustChoose}>
            <Stack.Screen name="choose-password" />
          </Stack.Protected>
          <Stack.Protected guard={!updateRequired && signedIn && !mustChoose}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profile" options={profileScreenOptions(Platform.OS, colors, () => router.back())} />
          <Stack.Screen name="sync" options={{ presentation: Platform.OS === "ios" ? "modal" : "card", headerShown: false }} />
          <Stack.Screen name="camera" options={{ presentation: "fullScreenModal", headerShown: false, animation: "slide_from_bottom" }} />
          <Stack.Screen name="photo-viewer" options={{ presentation: "fullScreenModal", headerShown: false, animation: "fade" }} />
          <Stack.Screen
            name="milestone-complete"
            options={{ presentation: "formSheet", sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: Platform.OS === "ios", headerStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen name="quote" options={{ presentation: "fullScreenModal", headerShown: false }} />
          <Stack.Screen name="expense-new" options={{ presentation: Platform.OS === "ios" ? "modal" : "card", headerShown: true, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: Platform.OS === "ios" }} />
          </Stack.Protected>
          <Stack.Protected guard={welcome}>
            <Stack.Screen name="welcome" options={{ animation: "none" }} />
          </Stack.Protected>
          <Stack.Protected guard={!updateRequired && !signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <SessionProvider>
        <WelcomeProvider>
          <SyncProvider>
            <RootStack />
          </SyncProvider>
        </WelcomeProvider>
      </SessionProvider>
    </SpineUIProvider>
  );
}
