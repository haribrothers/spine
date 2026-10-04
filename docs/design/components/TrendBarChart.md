# TrendBarChart

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/trend-bar-chart.tsx` · **Doc page:** `apps/design-system/src/app/components/trend-bar-chart/page.tsx`

A single-series bar chart with real value labels and a real empty state — the two things a bare Recharts BarChart inside ChartContainer doesn&apos;t give you for free, and both matter more on a small dashboard card than a full report page (a 12-bar chart with 11 empty months and no labels reads as broken, not quiet). Extracted from the dashboard&apos;s revenue trend and pipeline-by-stage widgets.

## Import

```tsx
import { TrendBarChartPoint, TrendBarChart } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `data` | TrendBarChartPoint[] | — |
| `color` | string | — |
| `emptyState` | ReactNode | — |

## Rules and behaviour

- Vertical orientation (bars grow up, category axis along the bottom) for a time trend, or horizontal (bars grow right, category axis on the left) for a ranked/categorical breakdown.
- Every non-zero bar gets a value label — zero-value points show a quiet "—" instead of a label-less sliver.
- A real empty state (emptyState prop) when every point is 0, instead of an axis with nothing on it.

## Exports

`TrendBarChartPoint` · `TrendBarChartProps` · `TrendBarChart`

## Accessibility

Automated check: `packages/ui/src/components/trend-bar-chart.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
