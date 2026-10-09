import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "../..");
const app = JSON.parse(readFileSync(join(MOBILE, "app.json"), "utf8")) as {
  expo: { icon: string; ios: { icon: { light: string; dark: string; tinted: string } }; android: { adaptiveIcon: Record<string, string> } };
};

/** Width, height and whether the PNG carries transparency (colour type 4 or 6). */
function png(path: string): { width: number; height: number; alpha: boolean } {
  const bytes = readFileSync(join(MOBILE, path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), alpha: bytes[25] === 4 || bytes[25] === 6 };
}

describe("US-MOB-24 · recognise Spine on my home screen", () => {
  it("gives iOS the full-bleed gradient icon with no transparency, plus dark and tinted versions", () => {
    expect(app.expo.icon).toBe("./assets/icon.png");
    expect(app.expo.ios.icon).toEqual({ light: "./assets/icon.png", dark: "./assets/ios-icon-dark.png", tinted: "./assets/ios-icon-tinted.png" });
    expect(png(app.expo.ios.icon.light)).toEqual({ width: 1024, height: 1024, alpha: false });
    // Dark and tinted are the mark alone; iOS draws the backdrop.
    expect(png(app.expo.ios.icon.dark)).toEqual({ width: 1024, height: 1024, alpha: true });
    expect(png(app.expo.ios.icon.tinted)).toEqual({ width: 1024, height: 1024, alpha: true });
    // Full bleed: iOS rounds the corners itself, so the source has none baked in.
    expect(readFileSync(join(MOBILE, "assets/brand/ios-icon-light.svg"), "utf8")).not.toMatch(/rx=/);
  });

  it("gives Android an adaptive icon: gradient background, the mark inside the safe circle, and a themed silhouette", () => {
    const icon = app.expo.android.adaptiveIcon;
    expect(icon).toEqual({
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    });
    expect(png(icon.backgroundImage!).alpha).toBe(false);
    expect(png(icon.foregroundImage!).alpha).toBe(true);
    expect(png(icon.monochromeImage!).alpha).toBe(true);
    // 62% of the 108 dp canvas keeps the mark inside the 66 dp circle every launcher shape shows.
    expect(readFileSync(join(MOBILE, "assets/brand/android-icon-foreground.svg"), "utf8")).toContain("scale(0.62)");
    expect(readFileSync(join(MOBILE, "assets/brand/android-icon-monochrome.svg"), "utf8")).toContain("scale(0.375)");
    expect(readFileSync(join(MOBILE, "assets/brand/android-icon-background.svg"), "utf8")).toMatch(/#04E9BC[\s\S]*#054DC1/);
  });

  it("has the 512 px full-bleed Play Store icon", () => {
    expect(png("assets/play-store-icon.png")).toEqual({ width: 512, height: 512, alpha: false });
  });

  it("drops Expo's placeholder icon and splash images", () => {
    expect(existsSync(join(MOBILE, "assets/splash-icon.png"))).toBe(false);
    expect(existsSync(join(MOBILE, "assets/favicon.png"))).toBe(false);
    expect(JSON.stringify(app)).not.toMatch(/splash-icon|favicon|#E6F4FE/);
  });
});
