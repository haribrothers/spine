# Input

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/input.tsx` · **Doc page:** `apps/design-system/src/app/components/input/page.tsx`

A single-line text field. 40px height, 6px radius, clear label above via FormField — never placeholder-only.

## Import

```tsx
import { Input } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `error` | boolean | false |
| `…` | standard <input> attributes | — |

## Rules and behaviour

- Renders a native &lt;input&gt;, so all native attributes (type, autoComplete, pattern, …) pass through.
- An error prop switches the border to the overdue color, paired with FormField's inline error text.
- Consistent 40px height across every text-style field in the library (Input, Select, DatePicker trigger, Combobox trigger).

## Exports

`InputProps` · `Input`

## Accessibility

Automated check: `packages/ui/src/components/input.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
