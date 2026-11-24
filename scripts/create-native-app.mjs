#!/usr/bin/env node
/**
 * Scaffolds a new Expo app under apps/<name> pre-wired for @spine/ui-native
 * — the "ng add"-equivalent for this monorepo's native apps, per
 * packages/ui-native/README.md. Generates ONLY the setup surface that used
 * to be hand-copied per app (tailwind.config.js, root layout, theme
 * storage, jest config, global.css, babel/metro/eslint/tsconfig, package.json,
 * app.json) — it does not attempt to merge into an existing app; run it
 * once against a brand-new, empty apps/<name> directory.
 *
 * Usage:
 *   node scripts/create-native-app.mjs <name> [--router=react-navigation|expo-router] [--web]
 *
 * --router (default react-navigation): which navigation library the app's
 *   generated root layout uses. React Navigation (apps/mobile,
 *   apps/design-system-native) needs a hand-written RootNavigator; expo-router
 *   (apps/showcase-native) needs `"main": "expo-router/entry"` and a file-based
 *   app/ directory instead of App.tsx.
 * --web: include a `localStorage` fallback branch in the generated theme
 *   storage (apps/design-system-native's pattern) instead of native-only
 *   expo-secure-store (apps/mobile's / apps/showcase-native's pattern) —
 *   expo-secure-store has no web implementation at all, so an app targeting
 *   web needs this branch or theme persistence silently no-ops there.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function parseArgs(argv) {
  const [name, ...rest] = argv;
  if (!name || name.startsWith("--")) {
    console.error("Usage: node scripts/create-native-app.mjs <name> [--router=react-navigation|expo-router] [--web]");
    process.exit(1);
  }
  let router = "react-navigation";
  let web = false;
  for (const arg of rest) {
    if (arg.startsWith("--router=")) {
      router = arg.slice("--router=".length);
    } else if (arg === "--web") {
      web = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (router !== "react-navigation" && router !== "expo-router") {
    console.error(`--router must be "react-navigation" or "expo-router", got "${router}"`);
    process.exit(1);
  }
  return { name, router, web };
}

const { name, router, web } = parseArgs(process.argv.slice(2));
const appDir = join(repoRoot, "apps", name);
const pkgName = `@spine/${name}`;

if (existsSync(appDir)) {
  console.error(`apps/${name} already exists — this script only scaffolds brand-new apps, it does not merge into an existing one.`);
  process.exit(1);
}

function write(relPath, content) {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  console.log(`  created apps/${name}/${relPath}`);
}

// --- Versions, read from packages/ui-native's own peerDependencies so this
// script can't silently drift from what the library actually expects. ---
const uiNativePkg = JSON.parse(readFileSync(join(repoRoot, "packages/ui-native/package.json"), "utf8"));
const peer = uiNativePkg.peerDependencies ?? {};
const reactVersion = peer.react ?? "19.2.3";
const reactNativeVersion = peer["react-native"] ?? "0.86.3";
const safeAreaVersion = peer["react-native-safe-area-context"] ?? "~5.7.0";
const statusBarVersion = peer["expo-status-bar"] ?? "~57.0.1";

console.log(`Scaffolding apps/${name} (${pkgName}), router=${router}, web=${web}\n`);

// --- package.json ---
const basePackageJson = {
  name: pkgName,
  private: true,
  version: "0.0.0",
  main: router === "expo-router" ? "expo-router/entry" : "index.ts",
  scripts: {
    start: "expo start",
    android: "expo run:android",
    ios: "expo run:ios",
    lint: "eslint .",
    typecheck: "tsc --noEmit",
    test: 'echo "no tests yet"',
  },
  dependencies: {
    "@spine/ui-native": "workspace:*",
    expo: "~57.0.30",
    "expo-secure-store": "~57.0.4",
    "expo-status-bar": statusBarVersion,
    "lucide-react-native": "^1.37.0",
    nativewind: "^4.2.6",
    react: reactVersion,
    "react-native": reactNativeVersion,
    "react-native-css-interop": "^0.2.6",
    "react-native-reanimated": "4.5.5",
    "react-native-safe-area-context": safeAreaVersion,
    "react-native-screens": "~4.26.0",
    "react-native-svg": "15.15.4",
    "react-native-worklets": "0.10.1",
    tailwindcss: "^3",
  },
  devDependencies: {
    "@spine/config": "workspace:*",
    "@types/react": "~19.2.2",
    eslint: "^9.17.0",
    "eslint-config-expo": "~10.0.0",
    typescript: "~6.0.3",
  },
};
if (router === "expo-router") {
  basePackageJson.dependencies["expo-constants"] = "^57.0.22";
  basePackageJson.dependencies["expo-linking"] = "^57.0.13";
  basePackageJson.dependencies["expo-router"] = "57.0.28";
} else {
  basePackageJson.dependencies["@react-navigation/bottom-tabs"] = "^7.18.18";
  basePackageJson.dependencies["@react-navigation/native"] = "^7.3.18";
}
write("package.json", `${JSON.stringify(basePackageJson, null, 2)}\n`);

// --- app.json ---
const slug = `spine-${name}`;
const bundleId = `com.spine.${name.replace(/-/g, "")}`;
const appJson = {
  expo: {
    name: `Spine ${name.charAt(0).toUpperCase()}${name.slice(1)}`,
    slug,
    version: "0.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: slug,
    ios: { supportsTablet: true, bundleIdentifier: bundleId },
    android: {
      package: bundleId,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    plugins: router === "expo-router" ? ["expo-router", "expo-secure-store"] : ["expo-secure-store"],
  },
};
if (web) {
  appJson.expo.web = { favicon: "./assets/favicon.png" };
}
write("app.json", `${JSON.stringify(appJson, null, 2)}\n`);

// --- tailwind.config.js (packages/ui-native/README.md's documented pattern) ---
const content =
  router === "expo-router"
    ? `["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"]`
    : `["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"]`;
write(
  "tailwind.config.js",
  `const { themeExtend } = require("@spine/ui-native/tailwind-preset");

/**
 * \`themeExtend\` (colors/radius/spacing) comes entirely from
 * \`@spine/ui-native/tailwind-preset\` — see that file's own doc comment for
 * why it's a plain \`theme.extend\`-shaped object spread in here directly,
 * NOT a Tailwind \`presets\` array entry. \`content\`/\`darkMode\` stay here,
 * per-app, since \`content\` is a real per-app file-scanning glob.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ${content},
  presets: [require("nativewind/preset")],
  theme: {
    extend: themeExtend,
  },
  plugins: [],
};
`,
);

// --- global.css ---
write("global.css", `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);

// --- babel.config.js / metro.config.js (identical across every app) ---
write(
  "babel.config.js",
  `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
`,
);
write(
  "metro.config.js",
  `const { getDefaultConfig } = require("expo/metro-config");
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
`,
);

// --- eslint.config.js / tsconfig.json (extend the shared presets) ---
write("eslint.config.js", `import base from "@spine/config/eslint/expo";\n\nexport default base;\n`);
write("tsconfig.json", `${JSON.stringify({ extends: "@spine/config/tsconfig/expo" }, null, 2)}\n`);
write(
  "nativewind-env.d.ts",
  [
    '/// <reference types="nativewind/types" />',
    "",
    "/** NativeWind's own global.css side-effect import — Metro handles it at bundle time; tsc just needs to know the module exists. */",
    'declare module "*.css";',
    "",
  ].join("\n"),
);

// --- theme-storage.ts ---
const themeStorageKey = `spine.${name}.theme-preference`;
const themeStorage = web
  ? `import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "${themeStorageKey}";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * \`expo-secure-store\` has no web implementation at all (its \`.web.ts\` is an
 * empty stub), so this branches: \`localStorage\` on web (a theme preference
 * isn't remotely sensitive, so a bare synchronous browser API is fine),
 * \`expo-secure-store\` on native for consistency with this repo's other apps.
 */
export const persistentThemeStorage: ThemeStorage = {
  async getPreference() {
    if (Platform.OS === "web") {
      const value = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      return isValidPreference(value) ? value : null;
    }
    const value = await SecureStore.getItemAsync(KEY);
    return isValidPreference(value) ? value : null;
  },
  async setPreference(preference) {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, preference);
      return;
    }
    await SecureStore.setItemAsync(KEY, preference);
  },
};
`
  : `import * as SecureStore from "expo-secure-store";
import type { ThemePreference, ThemeStorage } from "@spine/ui-native";

const KEY = "${themeStorageKey}";

function isValidPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * \`expo-secure-store\`-backed implementation of @spine/ui-native's
 * \`ThemeStorage\` contract. This app is native-only (no web target); if it
 * ever gets one, \`expo-secure-store\` has no web implementation, so branch on
 * \`Platform.OS\` and use \`localStorage\` there.
 */
export const persistentThemeStorage: ThemeStorage = {
  async getPreference() {
    const value = await SecureStore.getItemAsync(KEY);
    return isValidPreference(value) ? value : null;
  },
  async setPreference(preference) {
    await SecureStore.setItemAsync(KEY, preference);
  },
};
`;
write("src/lib/theme-storage.ts", themeStorage);

// --- jest.config.js ---
write(
  "jest.config.js",
  `/** @type {import('jest').Config} */
module.exports = {
  ...require("@spine/ui-native/jest-config-base"),
};
`,
);

// --- root layout ---
if (router === "expo-router") {
  write(
    "app/_layout.tsx",
    `import "../global.css";
import { Stack } from "expo-router";
import { SpineUIProvider } from "@spine/ui-native";
import { persistentThemeStorage } from "../src/lib/theme-storage";

export default function RootLayout() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <Stack screenOptions={{ headerShown: false }} />
    </SpineUIProvider>
  );
}
`,
  );
  write(
    "app/index.tsx",
    `import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-on-surface dark:text-on-surface-dark">Welcome to ${pkgName}</Text>
    </View>
  );
}
`,
  );
} else {
  write(
    "App.tsx",
    `import "./global.css";
import { SpineUIProvider } from "@spine/ui-native";
import { RootNavigator } from "./src/navigation/root-navigator";
import { persistentThemeStorage } from "./src/lib/theme-storage";

export default function App() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <RootNavigator />
    </SpineUIProvider>
  );
}
`,
  );
  write(
    "index.ts",
    `import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
`,
  );
  write(
    "src/navigation/root-navigator.tsx",
    `import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeIcon from "lucide-react-native/icons/house";
import { useTheme } from "@spine/ui-native";
import { spineDarkNavigationTheme, spineLightNavigationTheme, spineTabBarScreenOptions, TabBarIcon } from "@spine/ui-native/navigation";
import { HomeScreen } from "../features/home/home-screen";

export type RootTabParamList = {
  Home: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  const { resolvedMode } = useTheme();

  return (
    <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
      <Tab.Navigator screenOptions={spineTabBarScreenOptions(resolvedMode)}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarIcon: (props) => <TabBarIcon icon={HomeIcon} {...props} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
`,
  );
  write(
    "src/features/home/home-screen.tsx",
    `import { Text, View } from "react-native";

export function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-on-surface dark:text-on-surface-dark">Welcome to ${pkgName}</Text>
    </View>
  );
}
`,
  );
}

console.log(`
Done. Still needed before this app runs:
  1. Copy app icon/splash assets into apps/${name}/assets/ (see apps/mobile/assets/
     or apps/showcase-native/assets/ for the required filenames — icon.png,
     android-icon-foreground.png, android-icon-background.png,
     android-icon-monochrome.png${web ? ", favicon.png" : ""}).
  2. pnpm install (to link the new workspace package).
  3. Add a "dev:${name}" script to the root package.json if you want a
     top-level shortcut, matching the "dev:mobile"/"dev:showcase-native" pattern.
  4. pnpm --filter ${pkgName} start
`);
