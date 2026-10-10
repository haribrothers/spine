# StatCard

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/stat-card.tsx` · **Doc page:** `apps/design-system/src/app/components/stat-card/page.tsx`

A Card variant for a single dashboard KPI — cash position, receivables, overdue count.

## Import

```tsx
import { StatCard } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `label` | string | — |
| `value` | string | — |
| `detail` | string | — |
| `tone` | 'default' \| 'warning' | 'default' |
| `trend` | { direction: 'up' \| 'down' \| 'neutral'; label: string } | — |

## Rules and behaviour

- An optional trend indicator colors green/red/neutral by direction, independent of financial-status semantics.
- `detail` shows a smaller figure beside the value (the amount behind a count, US-QUO-27); `tone="warning"` colours the value due-soon, with the label saying why.

## Exports

`StatCardProps` · `StatCard`

## Accessibility

Automated check: `packages/ui/src/components/stat-card.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
