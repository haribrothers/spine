# ScrollEdgeMask

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/scroll-edge-mask.tsx` · **Doc page:** none yet

A fade-to-background gradient mask for the top/bottom edge of a scrollable viewport — the Android (and web) counterpart to iOS's real system-compositor blur, which `headerTransparent`/`headerBlurEffect` (top) and `NativeTabs`'s own default `disableTransparentOnScrollEdge: false` behavior (bottom) already provide for free on iOS with zero extra component needed.

## Import

```tsx
import { ScrollEdgeMask } from "@spine/ui-native";
```

## Exports

`ScrollEdgeMaskProps` · `ScrollEdgeMask`

## Accessibility

Automated check: `packages/ui-native/src/components/scroll-edge-mask.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
