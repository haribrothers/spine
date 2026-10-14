# TabBar

**Package:** `@spine/ui-native/navigation` · **Platform:** Native · **Source:** `packages/ui-native/src/navigation/tab-bar.tsx` · **Doc page:** none — its page went with `apps/design-system-native` (D-240); no app uses it since the field app moved to native tabs (US-MOB-19)

Themed `screenOptions` and a matching icon helper for `createBottomTabNavigator` — React Navigation&apos;s own tab bar isn&apos;t a NativeWind-styled component, so it needs real color values resolved from the current theme rather than `dark:` classes.

## Import

```tsx
import { TabBarIcon } from "@spine/ui-native/navigation";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `TabBarIcon` | { icon: LucideIcon; color: string; size: number } | — |

## Rules and behaviour

- spineTabBarScreenOptions(resolvedMode) themes the tab bar's background, border, and active/inactive tint colors from the same light/dark tokens every other component uses.
- TabBarIcon renders a lucide-react-native icon component (the same icon set web's packages/ui uses via lucide-react) — passed as a component reference, not a string name, so a typo is a build error, not a silently-blank icon.
- Each Tab.Screen still supplies its own icon component and title — those are necessarily per-route, not shared.

## Exports

`spineTabBarScreenOptions` · `TabBarIcon`

## Accessibility

No automated a11y test file found — required before this component changes (see `docs/prd/09-design-system.md`).
