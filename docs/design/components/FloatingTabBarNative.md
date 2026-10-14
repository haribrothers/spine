# FloatingTabBar

**Package:** `@spine/ui-native/navigation` · **Platform:** Native · **Source:** `packages/ui-native/src/navigation/floating-tab-bar.tsx` · **Doc page:** none — its page went with `apps/design-system-native` (D-240); no app uses it since the field app moved to native tabs (US-MOB-19)

A fully custom bottom tab bar — a floating, rounded, inset pill with each tab&apos;s icon stacked above its label, and the active tab&apos;s highlight capsule sliding smoothly between tabs on selection, matching iOS&apos;s standard tab bar height/label sizing. Replaces React Navigation&apos;s default tab bar entirely rather than just theming it (see Bottom Tab Bar for that lighter option).

## Import

```tsx
import { FLOATING_TAB_BAR_RESERVED_HEIGHT, FloatingTabBar } from "@spine/ui-native/navigation";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `FloatingTabBar` | BottomTabBarProps & { resolvedMode: \ | — |
| `FLOATING_TAB_BAR_RESERVED_HEIGHT` | number (77 — iOS's 49pt UITabBar height + outer padding) | — |

## Rules and behaviour

- Fully replaces React Navigation's default tab bar via the tabBar prop — every tab shows its icon stacked above its label; the active tab's highlight capsule slides smoothly to the newly selected tab instead of instantly swapping.
- Height (49pt) and label size (10pt) match iOS's own UITabBar/UITabBarItem defaults; icon size (24pt) matches lucide-react-native's own default rather than iOS's 25pt, a deliberate 1pt departure.
- Uses lucide-react-native icons (the same set web's packages/ui uses via lucide-react) for a uniform, predictable glyph bounding box per icon — fixes a real icon-vertical-alignment bug the earlier icon-font-based icons had.
- Reads each screen's tabBarIcon/title from React Navigation's own descriptors — no separate icon/label config needed beyond what a themed tab bar already requires.
- Uses BottomTabBarProps' own insets (no separate useSafeAreaInsets call) to pad above the home indicator.
- Reimplements press handling with the same tabPress event contract the default tab bar uses, and sets accessibilityRole/accessibilityState itself, since replacing the tab bar means none of that comes for free anymore.

## Exports

`FloatingTabBarProps` · `FLOATING_TAB_BAR_RESERVED_HEIGHT` · `FloatingTabBar`

## Accessibility

No automated a11y test file found — required before this component changes (see `docs/prd/09-design-system.md`).
