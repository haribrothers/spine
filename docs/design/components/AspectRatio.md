# AspectRatio

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/aspect-ratio.tsx` · **Doc page:** `apps/design-system/src/app/components/aspect-ratio/page.tsx`

Displays content within a desired ratio. Constrains embedded media (job/site photo thumbnails) to a fixed ratio so layout doesn't jump before the asset loads.

## Import

```tsx
import { AspectRatio } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `ratio` | number | 1 |

## Rules and behaviour

- Accepts any ratio, not just common presets — pass width / height.

## Exports

`AspectRatio`

## Accessibility

Automated check: `packages/ui/src/components/aspect-ratio.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
