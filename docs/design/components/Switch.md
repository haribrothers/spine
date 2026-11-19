# Switch

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/switch.tsx` · **Doc page:** `apps/design-system/src/app/components/switch/page.tsx`

A control that allows toggling between checked and not checked — e.g. "require owner approval" flags.

## Import

```tsx
import { Switch } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `checked` | boolean | — |
| `defaultChecked` | boolean | — |
| `onCheckedChange` | (checked: boolean) => void | — |
| `disabled` | boolean | false |

## Rules and behaviour

- Full keyboard navigation.
- Can be controlled or uncontrolled.
- Under 768px it keeps its own size; its 44px tap area is drawn around it (`data-tap-area`), never as a blank box (US-OPS-61).

## Exports

`Switch`

## Accessibility

Automated check: `packages/ui/src/components/switch.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
