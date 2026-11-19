# DatePicker

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/date-picker.tsx` · **Doc page:** `apps/design-system/src/app/components/date-picker/page.tsx`

Opens a Popover-hosted calendar rather than relying on native chrome, which is inconsistent across browsers and OSes.

## Import

```tsx
import { DatePicker } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | Date | — |
| `onChange` | (date: Date) => void | — |
| `placeholder` | string | — |
| `disabled` | boolean | false |

## Rules and behaviour

- A month-grid Calendar with prev/next navigation, no external date library dependency.
- Hosted in a Popover, closes automatically on selection.
- Field trigger shares Input/Select's chrome and height for a consistent form row.

## Phone (under 768px, [D-283](../../prd/12-decisions.md))

- Built (US-OPS-60): the popover is marked `data-phone-sheet`; the month docks to the bottom edge, centred.
- Under 768px the calendar opens in a `BottomSheet` (US-OPS-60).

## Exports

`DatePickerProps` · `DatePicker`

## Accessibility

Automated check: `packages/ui/src/components/date-picker.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
