# KpiCard

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/kpi-card.tsx` · **Doc page:** none yet

A gradient-filled stat card — label, value, trend text, and an icon. Originally built for `apps/showcase-native`'s Home screen (its horizontally-scrolling KPI carousel) — extracted here since the card itself has zero dashboard-specific logic (no "revenue"/"jobs" concept anywhere in this file, just `label`/`value`/`trend`/`icon`/`gradient`); the carousel wrapper (a horizontal `ScrollView` with `snapToInterval`) and the specific stat data stay screen-local, since those genuinely are dashboard-specific.

## Import

```tsx
import { KpiCard } from "@spine/ui-native";
```

## Exports

`KpiCardProps` · `KpiCard`

## Accessibility

Automated check: `packages/ui-native/src/components/kpi-card.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
