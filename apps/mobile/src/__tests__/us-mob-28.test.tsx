import { versionLine } from "../lib/app-version";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require("../../app.config.js") as (ctx: { config: Record<string, unknown> }) => Record<string, any>;
const appJson = require("../../app.json") as { expo: Record<string, unknown> };
const root = require("../../../../package.json") as { version: string };

describe("US-MOB-28 · give testers the field app through TestFlight and an APK", () => {
  it("the app's store version is the product's X.Y.Z, and the full version (a beta's too) travels with it", () => {
    const config = appConfig({ config: appJson.expo });
    expect(config.version).toBe(root.version.split("-")[0]);
    expect(config.extra.spineVersion).toBe(root.version);
  });

  it("Profile names a beta as one", () => {
    expect(versionLine("1.0.0-beta.1", "12")).toBe("Spine 1.0.0-beta.1 (12) · Beta");
    expect(versionLine("1.0.0", "40")).toBe("Spine 1.0.0 (40)");
    expect(versionLine("1.0.1", null)).toBe("Spine 1.0.1");
  });

  it("each build's number (the commit count, from build-beta.sh) is iOS's build number and Android's versionCode, so testers get updates", () => {
    process.env.SPINE_BUILD_NUMBER = "412";
    try {
      const config = appConfig({ config: appJson.expo });
      expect(config.ios.buildNumber).toBe("412");
      expect(config.android.versionCode).toBe(412);
    } finally {
      delete process.env.SPINE_BUILD_NUMBER;
    }
    expect(appConfig({ config: appJson.expo }).android.versionCode).toBeUndefined();
  });

  it("the app is com.h4loom.spine (D-271)", () => {
    const config = appConfig({ config: appJson.expo });
    expect(config.ios.bundleIdentifier).toBe("com.h4loom.spine");
    expect(config.android.package).toBe("com.h4loom.spine");
  });

  it("a test build can use another bundle id", () => {
    process.env.SPINE_IOS_BUNDLE_ID = "com.example.spine";
    process.env.SPINE_ANDROID_PACKAGE = "com.example.spine";
    try {
      const config = appConfig({ config: appJson.expo });
      expect(config.ios.bundleIdentifier).toBe("com.example.spine");
      expect(config.android.package).toBe("com.example.spine");
    } finally {
      delete process.env.SPINE_IOS_BUNDLE_ID;
      delete process.env.SPINE_ANDROID_PACKAGE;
    }
  });
});
