/**
 * US-MOB-28 (D-262, D-265, D-266) — the field app's config is app.json, plus:
 * - the product version from the root package.json. iOS and Android take only
 *   `X.Y.Z` as the app's version, so a beta (`1.0.0-beta.1`) ships as `1.0.0`
 *   with the full version in `extra.spineVersion`, which Profile shows with
 *   "Beta"; each build's number goes up on its own (eas.json).
 * - the bundle id and the EAS project, from the environment when they're set
 *   (SPINE_IOS_BUNDLE_ID, SPINE_ANDROID_PACKAGE, EAS_PROJECT_ID). The bundle id
 *   can't change after the first App Store or TestFlight upload, so set the
 *   final one, from the domain, before that.
 */
const root = require("../../package.json");

module.exports = ({ config }) => {
  const [core] = root.version.split("-");
  return {
    ...config,
    version: core,
    ios: { ...config.ios, bundleIdentifier: process.env.SPINE_IOS_BUNDLE_ID || config.ios.bundleIdentifier },
    android: { ...config.android, package: process.env.SPINE_ANDROID_PACKAGE || config.android.package },
    extra: {
      ...config.extra,
      spineVersion: root.version,
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  };
};
