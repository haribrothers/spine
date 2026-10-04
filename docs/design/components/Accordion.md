# Accordion

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/accordion.tsx` · **Doc page:** `apps/design-system/src/app/components/accordion/page.tsx`

A vertically stacked set of interactive headings that each reveal an associated section of content — built from Collapsible. Single-open or multi-open.

## Import

```tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `type` | single \| multiple | — |
| `collapsible` | boolean | false (single type only) |
| `value` | string \| string[] | — |
| `onValueChange` | (value: string \| string[]) => void | — |

## Rules and behaviour

- Full keyboard navigation.
- Can expand one or multiple items.
- Can be controlled or uncontrolled.
- Supports RTL direction.

## Exports

`Accordion` · `AccordionItem` · `AccordionTrigger` · `AccordionContent`

## Accessibility

Automated check: `packages/ui/src/components/accordion.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
