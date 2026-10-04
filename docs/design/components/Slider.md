# Slider

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/slider.tsx` · **Doc page:** `apps/design-system/src/app/components/slider/page.tsx`

An input where the user selects a value from within a given range — e.g. a discount percentage or retention percentage. Primary-filled track.

## Import

```tsx
import { Slider } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | number[] | — |
| `defaultValue` | number[] | — |
| `onValueChange` | (value: number[]) => void | — |
| `min` | number | 0 |
| `max` | number | 100 |
| `step` | number | 1 |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Supports multiple thumbs for a range.
- Full keyboard navigation.

## Exports

`Slider`

## Accessibility

Automated check: `packages/ui/src/components/slider.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
