# Skeleton

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/skeleton.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/skeleton-demo.tsx`

A pulsing block matching the shape of the loading content — used for genuinely slow loads, not every async state.

## Import

```tsx
import { Skeleton } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard View props | — |

## Rules and behaviour

- A plain sizable block — pass width/height utility classes to match the content it replaces.
- The pulse is driven by RN's own Animated API, not a className — NativeWind (checked directly against the installed v4 dist) doesn't implement Tailwind's animate-* keyframe utilities, so a bare animate-pulse className would silently do nothing here.
- A real, confirmed-live bug found building this: putting className directly on the outer Animated.View compiled the opacity animation correctly but silently dropped every NativeWind class (bg-border-strong, h-4, w-48 — all gone) specifically on Expo web, even though the same code renders correctly on real iOS/Android. Fixed by moving className onto a plain View nested inside the Animated.View, which only carries the animated opacity style.
- A second real, confirmed-live bug, reported after the first fix: the block was invisible specifically in dark mode. Skeleton originally used the plain border token (bg-border), whose dark value is identical to surface-sunken's dark value — the background this preview box (and any similarly sunken container) renders against — so the block was the exact same color as its own background. Fixed by switching to border-strong, which is a genuinely distinct color from surface-sunken in both themes.

## Exports

`Skeleton`

## Accessibility

Automated check: `packages/ui-native/src/components/skeleton.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
