import { readFileSync } from "node:fs";
import { join } from "node:path";
import { darkColors, lightColors } from "@spine/ui-native/tokens";
import { redirectSystemPath } from "../../app/+native-intent";

const MOBILE = join(__dirname, "../..");
type SplashConfig = { image: string; imageWidth: number; backgroundColor: string; dark: { image: string; backgroundColor: string } };
const app = JSON.parse(readFileSync(join(MOBILE, "app.json"), "utf8")) as { expo: { plugins: (string | [string, unknown])[] } };
const splash = app.expo.plugins.find((plugin): plugin is [string, SplashConfig] => Array.isArray(plugin) && plugin[0] === "expo-splash-screen")![1];

describe("US-MOB-25 · see Spine while the app opens", () => {
  it("shows the 96 dp gradient mark on the page colour, light and dark, and nothing else", () => {
    expect(splash).toMatchObject({ image: "./assets/splash-mark.png", imageWidth: 96, backgroundColor: lightColors.background, dark: { image: "./assets/splash-mark.png", backgroundColor: darkColors.background } });
    expect([lightColors.background, darkColors.background]).toEqual(["#F7F6F3", "#121110"]);
    const art = readFileSync(join(MOBILE, "assets/brand/splash-mark.svg"), "utf8");
    // The three layers, no wordmark (its letters are primary) and no tile.
    expect(art.match(/<path /g)).toHaveLength(3);
    expect(art).not.toMatch(/#2954E5|<rect/);
  });

  it("holds the splash from launch and hides it once, when the first screen has drawn", () => {
    jest.isolateModules(() => {
      const SplashScreen = jest.requireMock<{ preventAutoHideAsync: jest.Mock; hideAsync: jest.Mock }>("expo-splash-screen");
      const { hideSplash } = jest.requireActual<typeof import("../lib/splash")>("../lib/splash");
      expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
      expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
      hideSplash();
      hideSplash();
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for the session and the Welcome flag, then hides on the first layout — except Welcome, which takes over itself", () => {
    const layout = readFileSync(join(MOBILE, "app/_layout.tsx"), "utf8");
    expect(layout.indexOf('from "../src/lib/splash"')).toBeLessThan(layout.indexOf("expo-router"));
    expect(layout).toContain('if (state.status === "loading" || welcomeSeen === null) return null;');
    expect(layout).toContain("onLayout={welcome ? undefined : hideSplash}");
  });

  it("opens on the first screen when a development build is launched from its dev-client link", () => {
    expect(redirectSystemPath({ path: "spine://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081", initial: true })).toBe("/");
    expect(redirectSystemPath({ path: "/quote/q-1", initial: false })).toBe("/quote/q-1");
  });
});
