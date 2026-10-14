# DateTimePicker

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/date-time-picker.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/date-time-picker-demo.tsx`

A compact, inline date/time control — same `Switch`-style row shape (label on the left, control on the right) as any other form row, rather than a full-width block field.

## Import

```tsx
import { DateTimePicker } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | Date | — |
| `onChange` | (date: Date) => void | — |
| `minimumDate` | Date | — |
| `maximumDate` | Date | — |
| `disabled` | boolean | false |

## Rules and behaviour

- Sizes to its own compact content, not a full-width block — designed to sit in a Switch-style row next to a label.
- Tapping the control opens a real native picker on both platforms.
- date
- time
- datetime

## Exports

`DateTimePickerProps` · `DateTimePicker`

## Accessibility

Automated check: `packages/ui-native/src/components/date-time-picker.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
