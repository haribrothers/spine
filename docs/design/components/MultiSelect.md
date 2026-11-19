# MultiSelect

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/multi-select.tsx` · **Doc page:** `apps/design-system/src/app/components/multi-select/page.tsx`

The multi-value counterpart to Select — reach for this when more than one option can be picked at once (e.g. contacts on a job, tags on a catalogue item). Radix's Select primitive has no multi-select mode, so this is composed from Popover and a checkable option list instead, matching Combobox's structure. The trigger shows as many selected labels as fit, collapsing the rest into a "+N" chip.

## Import

```tsx
import { MultiSelectOption, MultiSelect } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `options` | { value: string; label: string }[] | — |
| `value` | string[] | — |
| `onValueChange` | (value: string[]) => void | — |
| `placeholder` | string | — |
| `disabled` | boolean | false |
| `aria-label` | string | — |
| `aria-labelledby` | string | — |

## Rules and behaviour

- On a phone its options open in a bottom sheet (`data-phone-sheet`), with 44px rows (US-OPS-60).
- Selecting an option toggles it — no need to hold a modifier key.
- The trigger measures its own width and shows as many selected labels as fit before collapsing the remainder into a "+N" chip, remeasured on resize.
- Each option shows a checkmark when selected, matching Select's affordance.
- Works as a controlled component — value is always an array, even when empty.

## Exports

`MultiSelectOption` · `MultiSelectProps` · `MultiSelect`

## Accessibility

Automated check: `packages/ui/src/components/multi-select.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
