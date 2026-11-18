# ScrollX

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/scroll-x.tsx` · **Doc page:** `apps/design-system/src/app/components/scroll-x/page.tsx` · **Stories:** US-OPS-15, US-OPS-62

A box whose content can be wider than the screen and scrolls sideways inside it, so the page never does. `Table`, `StatementTable`, document lines and every other wide table box use it.

## Import

```tsx
import { ScrollX } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `label` | string — names the region when it scrolls ("Table, scrolls sideways", `ui.scrollX.label`) | — |
| `…` | standard `<div>` attributes | — |

## Rules and behaviour

- When its content is wider than the box (usually only on a phone) it takes `tabIndex={0}`, `role="region"` and its `label`, so a keyboard can scroll it (WCAG 2.1.1, axe `scrollable-region-focusable`); its focus ring is drawn inside.
- When everything fits it adds no tab stop and no landmark.
- It's `position: relative`, so an absolutely positioned child (an `sr-only` column label) is clipped with the rest instead of widening the page.
- Use it instead of a bare `overflow-x-auto` div around a table.

## Accessibility

Automated check: `packages/ui/src/components/scroll-x.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
