# @spine/ui-native

Spine's React Native component + theming library. Apps (`apps/mobile`, `apps/design-system-native`, `apps/showcase-native`) consume this package rather than hand-rolling components or theme wiring per app. This file is a map of what to import from where, and the rules each import follows.

## Install

Workspace-internal only (`"@spine/ui-native": "workspace:*"`). Peer dependencies (`react`, `react-native`, `expo-status-bar`, `react-native-safe-area-context`) must match the versions this package was built against — check `package.json`'s `peerDependencies`. `@react-navigation/native`/`@react-navigation/bottom-tabs` are optional peers, needed only if you use the `./navigation` subpath.

## Subpath exports

| Import | What it gives you |
|---|---|
| `@spine/ui-native` | Every component, `SpineUIProvider`, `ThemeProvider`/`useTheme`, `useNativeColors`/`useNativeHostTheme`, shared hooks |
| `@spine/ui-native/tokens` | Raw design tokens (`lightColors`, `darkColors`, `radius`, `spacing`) as plain JS objects |
| `@spine/ui-native/tailwind-preset` | `{ themeExtend }` — spread into your app's `tailwind.config.js` `theme.extend` (see below) |
| `@spine/ui-native/navigation` | React Navigation theme/tab-bar helpers (`spineLightNavigationTheme`/`spineDarkNavigationTheme`, `spineTabBarScreenOptions`, `TabBarIcon`, `FloatingTabBar`) |
| `@spine/ui-native/jest-config-base` | Shared Jest config fixing the Lucide ESM/CJS resolution issue — extend it if your app adds tests |

## Creating a new app

**Always use the scaffold script to create a new app — never hand-write these files or copy another app's.**

```
node scripts/create-native-app.mjs <name> [--router=react-navigation|expo-router] [--web]
```

- `<name>` becomes `apps/<name>` and the package `@spine/<name>`.
- `--router` (default `react-navigation`) picks the generated root layout: `react-navigation` (like `apps/mobile`) writes `App.tsx` + a `RootNavigator`; `expo-router` (like `apps/showcase-native`) writes a file-based `app/_layout.tsx` and sets `"main": "expo-router/entry"`.
- `--web` includes a `localStorage` fallback branch in the generated theme-storage util (like `apps/design-system-native`) — omit it for a native-only app, since `expo-secure-store` alone has no web implementation.

It generates every file in the setup surface (`tailwind.config.js`, root layout, `theme-storage.ts`, `jest.config.js`, `global.css`, `babel.config.js`, `metro.config.js`, `eslint.config.js`, `tsconfig.json`, `nativewind-env.d.ts`, `package.json`, `app.json`) with dependency versions read from this package's own `peerDependencies`, so they can't silently drift from what `packages/ui-native` actually expects. It does not scaffold binary assets (icons/splash) or merge into an existing app — it only writes into a fresh, empty `apps/<name>` directory. Follow the printed next-steps (copy assets, `pnpm install`, optionally add a `dev:<name>` root script) to finish.

The "Getting a new app running" steps below are **reference only** — they explain what the script generates and why, for when you need to understand or debug the wiring (e.g. adding this pattern to an app that predates the script, or tracing why a generated file looks the way it does). Do not follow them to set up a new app by hand.

## Getting a new app running (reference — the script above does this for you)

1. **Tailwind.** Your `tailwind.config.js` only needs `content`/`darkMode`/`presets` — colors, radius, and spacing come from the preset:
   ```js
   const { themeExtend } = require("@spine/ui-native/tailwind-preset");
   module.exports = {
     darkMode: "class",
     content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"],
     presets: [require("nativewind/preset")],
     theme: { extend: themeExtend },
     plugins: [],
   };
   ```
   Do **not** add `@spine/ui-native/tailwind-preset` as a second entry in `presets` — see the preset file's own doc comment for the real regression that causes (`nativewind/preset`'s RN-specific `boxShadow` scale gets reset to Tailwind's web defaults).

2. **Root provider.** Wrap your app root in `SpineUIProvider`, supplying a `ThemeStorage` adapter (persist however fits your app — `expo-secure-store` on native, `localStorage` on web; see `apps/*/src/lib/theme-storage.ts` for worked examples):
   ```tsx
   import { SpineUIProvider } from "@spine/ui-native";
   import { myThemeStorage } from "./src/lib/theme-storage";

   export default function App() {
     return (
       <SpineUIProvider storage={myThemeStorage}>
         <MyRootNavigator />
       </SpineUIProvider>
     );
   }
   ```
   This wires `ThemeProvider` + `SafeAreaProvider` + `StatusBar` in one call. Nest any app-specific top-level providers (a profile-sheet context, etc.) inside or around it — `SpineUIProvider` only owns what `packages/ui-native` itself requires.

3. **React Navigation (if used).** Pass `spineLightNavigationTheme`/`spineDarkNavigationTheme` to `NavigationContainer`'s `theme` prop, or use `FloatingTabBar`/`spineTabBarScreenOptions` for tab-bar chrome. React Navigation's own chrome ignores NativeWind `dark:` classes entirely — it only reacts to this `theme` prop.

4. **Jest (if your app adds tests).** Extend the shared base instead of rediscovering the Lucide ESM/CJS fix:
   ```js
   module.exports = {
     ...require("@spine/ui-native/jest-config-base"),
     // your app-specific overrides (setupFilesAfterEnv, etc.)
   };
   ```

## Dark mode

Every themed color is registered twice by the tailwind preset — once plain (`surface`), once suffixed `-dark` (`surface-dark`) — and every themed component pairs its classNames accordingly (`className="bg-surface dark:bg-surface-dark"`). A `{ DEFAULT, dark }` color-object shape does **not** work with Tailwind/NativeWind. When writing app-level screens (not just `packages/ui-native` components), follow the same `bg-x dark:bg-x-dark` pairing convention or dark mode will silently do nothing for that element.

## Icons

Always import `lucide-react-native` icons via their per-icon subpath (`lucide-react-native/icons/house`), never the barrel import — the barrel pulls in all ~1900 icons regardless of usage. It also breaks Jest's module resolution.

## Accessibility

Every component ships a matching `<name>.a11y.test.tsx`, enforced by `scripts/check-a11y-coverage.mjs` as part of `pnpm test`. `@expo/ui`-backed components (Button, Switch, Select, Slider, ContextMenu, DateTimePicker, BottomSheet) use a props-based assertion pattern instead of a full accessibility-tree walk — see `button.a11y.test.tsx`'s own doc comment for the worked example.
