# GaugeIndicator

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/gauge-indicator.tsx` · **Doc page:** none yet

A semi-circular (180°) gauge, arc + filled progress + a centered value — NOT a full 360° ring. Per Mobbin research (Cleo's credit-score gauge, TradingView's buy/sell needle gauge, Acorns' Weak/Fair/Strong gauge, Binance's Fear & Greed gauge): every real "speedometer-style" dashboard indicator found was consistently a semi-circle with the value centered inside the arc, never a full ring (full rings — Apple Fitness/WHOOP-style — are a different, more common pattern reserved for a different framing this component deliberately does NOT use here).

## Import

```tsx
import { GaugeIndicator } from "@spine/ui-native";
```

## Exports

`GaugeIndicatorProps` · `GaugeIndicator`

## Accessibility

Automated check: `packages/ui-native/src/components/gauge-indicator.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
