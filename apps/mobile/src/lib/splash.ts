import * as SplashScreen from "expo-splash-screen";

/**
 * US-MOB-25 — the splash (the mark on the page colour, set in app.json)
 * stays up from launch until the first screen has drawn; it never waits on
 * the network. Welcome hides it itself once its mark sits where the
 * splash's mark is, so the hand-off doesn't jump.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 200 });

let hidden = false;

export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  void SplashScreen.hideAsync().catch(() => {});
}
