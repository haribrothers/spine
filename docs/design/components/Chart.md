# Chart

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/chart.tsx` · **Doc page:** `apps/design-system/src/app/components/chart/page.tsx`

A thin theming wrapper around Recharts. Categorical series default to the primary color plus muted greys; a chart displaying financial status (e.g. revenue by status) should pass explicit paid/due-soon/overdue colors instead — never mix the two palettes in the same chart.

## Import

```tsx
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `ChartContainer.config` | Record<string, { label?: ReactNode; color?: string }> | — |
| `ChartTooltipContent` | drop-in replacement for Recharts' Tooltip content prop | — |

## Rules and behaviour

- ChartContainer injects per-series CSS custom properties from a ChartConfig, so series color is data, not a hardcoded style prop.
- ChartTooltipContent renders a token-styled tooltip in place of Recharts' default.
- Works with any Recharts chart type (Bar, Line, Area, Pie, …) — ChartContainer just wraps ResponsiveContainer.

## Exports

`ChartConfig` · `ChartContainer` · `ChartTooltip` · `ChartTooltipContent` · `ChartLegend`

## Accessibility

Automated check: `packages/ui/src/components/chart.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
