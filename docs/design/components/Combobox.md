# Combobox

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/combobox.tsx` · **Doc page:** `apps/design-system/src/app/components/combobox/page.tsx`

The searchable counterpart to Select — reach for this when picking from a long list (a contact, a catalogue item) where typing to filter matters. Composed from Popover and cmdk rather than a dedicated Radix primitive, since Radix doesn't ship one.

## Import

```tsx
import { ComboboxOption, Combobox } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `options` | { value: string; label: string; description?: string \| null }[] | — |
| `value` | string | — |
| `onValueChange` | (value: string) => void | — |
| `placeholder` | string | — |
| `emptyText` | string | — |
| `disabled` | boolean | false |
| `allowCreate` | boolean | false |

## Rules and behaviour

- Type-to-filter search over the option list.
- Keyboard navigable — arrow keys move the highlight, Enter selects.
- Hosted in a Popover, matching the field's trigger width.
- Shows a configurable empty state when no options match.
- Options can carry a description: a second, muted line under the label (what an expense category is for, D-228), searched along with it.
- Optional allowCreate mode: typing a value with no matching option offers a "Create '…'" row, for open-ended, org-defined vocabularies (e.g. a catalogue item's unit or category) rather than a fixed list.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — planned

- Under 768px the options open in a `BottomSheet` with the search field at its top (US-OPS-60).

## Exports

`ComboboxOption` · `ComboboxProps` · `Combobox`

## Accessibility

Automated check: `packages/ui/src/components/combobox.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
