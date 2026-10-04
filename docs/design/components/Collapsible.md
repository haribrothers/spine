# Collapsible

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/collapsible.tsx` · **Doc page:** `apps/design-system/src/app/components/collapsible/page.tsx`

An interactive component which expands/collapses a panel. The single-block primitive Accordion is built from — a togglable section on its own.

## Import

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` | boolean | — |
| `defaultOpen` | boolean | — |
| `onOpenChange` | (open: boolean) => void | — |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Full keyboard navigation.

## Exports

`Collapsible` · `CollapsibleTrigger` · `CollapsibleContent`

## Accessibility

Automated check: `packages/ui/src/components/collapsible.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
