/**
 * US-MOB-28 (D-262, D-265, D-271) — the field app's config is app.json, plus:
 * - the product version from the root package.json. iOS and Android take only
 *   `X.Y.Z` as the app's version, so a beta (`1.0.0-beta.1`) ships as `1.0.0`
 *   with the full version in `extra.spineVersion`, which Profile shows with
 *   "Beta".
 * - the build number from SPINE_BUILD_NUMBER (scripts/mobile/build-beta.sh sets
 *   it to the commit count, so each build is newer than the last), as iOS's
 *   buildNumber and Android's versionCode.
 * - the bundle id (com.h4loom.spine, D-271) from SPINE_IOS_BUNDLE_ID and
 *   SPINE_ANDROID_PACKAGE when they're set, for a test build under another id.
 */
const root = require("../../package.json");

module.exports = ({ config }) => {
  const [core] = root.version.split("-");
  const build = Number(process.env.SPINE_BUILD_NUMBER);
  const hasBuild = Number.isInteger(build) && build > 0;
  return {
    ...config,
    version: core,
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.SPINE_IOS_BUNDLE_ID || config.ios.bundleIdentifier,
      ...(hasBuild ? { buildNumber: String(build) } : {}),
    },
    android: {
      ...config.android,
      package: process.env.SPINE_ANDROID_PACKAGE || config.android.package,
      ...(hasBuild ? { versionCode: build } : {}),
    },
    extra: { ...config.extra, spineVersion: root.version },
  };
};
