# Checkbox

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/checkbox.tsx` · **Doc page:** `apps/design-system/src/app/components/checkbox/page.tsx`

A control that allows the user to toggle between checked, unchecked, and indeterminate. 18px control with a 44px tap target via padding on touch surfaces, primary-blue fill when checked.

## Import

```tsx
import { Checkbox } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `checked` | boolean \| 'indeterminate' | — |
| `defaultChecked` | boolean | — |
| `onCheckedChange` | (checked: boolean \| 'indeterminate') => void | — |
| `disabled` | boolean | false |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Supports indeterminate state: `checked="indeterminate"` fills it and shows a minus, for a header box when only some rows are selected (US-CAT-12).
- Full keyboard navigation.
- Under 768px it keeps its 18px size; its 44px tap area is drawn around it (`data-tap-area`), never as a blank box (US-OPS-61).

## Exports

`Checkbox`

## Accessibility

Automated check: `packages/ui/src/components/checkbox.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
