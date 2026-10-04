# Progress

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/progress.tsx` · **Doc page:** `apps/design-system/src/app/components/progress/page.tsx`

Displays an indicator showing the completion progress of a task — e.g. "72% of matrix requirements met" or a job's cost-vs-budget. Primary-filled track.

## Import

```tsx
import { Progress } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | number | — |
| `max` | number | 100 |

## Rules and behaviour

- Provides context for screen reader users via aria-valuenow/aria-valuemax.

## Exports

`Progress`

## Accessibility

Automated check: `packages/ui/src/components/progress.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
