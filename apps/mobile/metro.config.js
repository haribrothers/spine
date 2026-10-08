const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * Monorepo wiring: Metro must also watch the workspace root (so changes to
 * @spine/ui-native/@spine/config trigger a rebuild) and resolve node_modules
 * from both this app's own folder and the hoisted workspace root (pnpm's
 * node_modules layout), matching Expo's own documented monorepo setup.
 */
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")];

module.exports = withNativeWind(config, { input: "./global.css" });
