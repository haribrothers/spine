# MoneyInput

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/money-input.tsx` · **Doc page:** `apps/design-system/src/app/components/money-input/page.tsx`

The currency/minor-unit-aware field required by PRD §F0. Right-aligned mono-data typography so a column of amounts aligns on the decimal, and it never accepts more precision than the currency supports — the value prop is always a bigint in minor units, never a float.

## Import

```tsx
import { MoneyInput } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | bigint | — |
| `onValueChange` | (amount: bigint) => void | — |
| `currency` | string (ISO 4217) | — |
| `error` | boolean | false |

## Rules and behaviour

- Backed by @spine/shared's toDecimalString/fromDecimalString so formatting can never drift from the ledger's own money math.
- Rejects keystrokes that would produce more fractional digits than the currency's minor-unit exponent supports.
- Correctly handles zero-decimal (JPY) and three-decimal (KWD, BHD, OMR) currencies, not just the common 2-decimal case.
- Snaps back to canonical formatting (e.g. "5" -&gt; "5.00") on blur.

## Exports

`MoneyInputProps` · `MoneyInput`

## Accessibility

Automated check: `packages/ui/src/components/money-input.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
