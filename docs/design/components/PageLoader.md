# PageLoader

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/page-loader.tsx` · **Doc page:** `apps/design-system/src/app/components/page-loader/page.tsx`

The "an operation is happening" indicator for a whole page or panel — show it any time a route, drawer, or section is fetching or submitting and there's nothing meaningful to render yet. Use Spinner instead for a single button's busy state, and Skeleton when the content's shape is already known.

## Import

```tsx
import { PageLoader } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `label` | string | — |
| `fullScreen` | boolean | false |

## Rules and behaviour

- Two modes: inline (absolute, fills the nearest positioned ancestor) and fullScreen (fixed to the viewport).
- Translucent surface-tinted backdrop with a blur, so underlying content stays legible as context rather than disappearing.
- fullScreen sits at z-overlay — one layer below z-modal — so a loader triggered from inside a Dialog/Drawer never outranks it.
- Built on Spinner, so it inherits the same polite role="status" live-region behavior.

## Exports

`PageLoaderProps` · `PageLoader`

## Accessibility

Automated check: `packages/ui/src/components/page-loader.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
