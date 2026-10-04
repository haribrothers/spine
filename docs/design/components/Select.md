# Select

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/select.tsx` · **Doc page:** `apps/design-system/src/app/components/select/page.tsx`

Displays a list of options for the user to pick from — triggered by a button. A flat, fixed list — e.g. a document status, a tax rate. Reach for Combobox instead when the list needs search-as-you-type filtering.

## Import

```tsx
import { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | string | — |
| `defaultValue` | string | — |
| `onValueChange` | (value: string) => void | — |
| `disabled` | boolean | false |
| `position` | item-aligned \| popper | popper |
| `value` | string | — |
| `disabled` | boolean | false |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Offers 2 positioning modes.
- Supports items, labels, groups of options.
- Focus is fully managed.
- Full keyboard navigation.
- Supports custom placeholder content.
- Typeahead support.
- Renders at the z-popover stacking tier, above Dialog/Drawer's z-modal tier — a Select opened from inside a Dialog or Drawer always renders on top of it, never hidden behind it. See the "Inside a Dialog" example below.

## Exports

`Select` · `SelectGroup` · `SelectValue` · `SelectTrigger` · `SelectContent` · `SelectLabel` · `SelectItem` · `SelectSeparator`

## Accessibility

Automated check: `packages/ui/src/components/select.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
