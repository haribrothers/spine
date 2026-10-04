# RadioGroup

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/radio-group.tsx` · **Doc page:** `apps/design-system/src/app/components/radio-group/page.tsx`

A set of checkable buttons — known as radio buttons — where no more than one can be checked at a time. E.g. tax-inclusive vs. tax-exclusive pricing.

## Import

```tsx
import { RadioGroup, RadioGroupItem } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | string | — |
| `defaultValue` | string | — |
| `onValueChange` | (value: string) => void | — |

## Rules and behaviour

- Full keyboard navigation.
- Can be controlled or uncontrolled.

## Exports

`RadioGroup` · `RadioGroupItem`

## Accessibility

Automated check: `packages/ui/src/components/radio-group.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
