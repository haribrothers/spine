# DonutChart

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/donut-chart.tsx` · **Doc page:** `apps/design-system/src/app/components/donut-chart/page.tsx`

A labeled donut chart — a Recharts pie inside ChartContainer, plus a real legend (label + formatted value per segment, not just a color swatch) and an optional center total. Extracted from the dashboard&apos;s AR aging widget so any future proportional breakdown (tax collected by rate, expense by category) reuses this instead of re-solving &quot;which color is which&quot; from scratch.

## Import

```tsx
import { DonutChartSegment, DonutChart } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `segments` | DonutChartSegment[] | — |
| `centerLabel` | ReactNode | — |
| `emptyState` | ReactNode | — |

## Rules and behaviour

- Real legend — every segment shows its label and a pre-formatted value, not just a colored dot.
- Optional center label, typically a total.
- A real empty state (emptyState prop) instead of an empty ring when every segment is 0.
- Callers own their own segment colors — pass the semantic paid/due-soon/overdue tokens for a financial-status breakdown, the categorical accent for anything else. Never mix the two palettes in one chart.

## Exports

`DonutChartSegment` · `DonutChartProps` · `DonutChart`

## Accessibility

Automated check: `packages/ui/src/components/donut-chart.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
