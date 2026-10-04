# Popover

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/popover.tsx` · **Doc page:** `apps/design-system/src/app/components/popover/page.tsx`

Displays rich content in a portal, triggered by a button. The general floating-card-on-click primitive — powers DatePicker and Combobox. Hosts real interactive content, unlike Tooltip which is supplementary text only.

## Import

```tsx
import { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` | boolean | — |
| `onOpenChange` | (open: boolean) => void | — |
| `modal` | boolean | false |
| `align` | start \| center \| end | center |
| `sideOffset` | number | 4 |
| `onOpenAutoFocus` | (event: Event) => void | — |
| `onEscapeKeyDown` | (event: KeyboardEvent) => void | — |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Customize side, alignment, offsets, collision handling.
- Optionally render a pointing arrow.
- Focus is fully managed and customizable.
- Dismissing and layering behavior is highly customizable.

## Exports

`Popover` · `PopoverTrigger` · `PopoverAnchor` · `PopoverContent`

## Accessibility

Automated check: `packages/ui/src/components/popover.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
