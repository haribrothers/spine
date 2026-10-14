# SelectField

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/select-field.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/select-field-demo.tsx`

A `TextField`-styled select — same border, height, radius, and colors as TextField — for forms where a select needs to visually match surrounding text fields. Opens a real native menu (SwiftUI Menu on iOS, Jetpack Compose DropdownMenu on Android) on tap.

## Import

```tsx
import { SelectFieldOption, SelectField } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `options` | { label: string; value: T }[] | — |
| `value` | T | — |
| `onValueChange` | (value: T) => void | — |
| `disabled` | boolean | false |
| `placeholder` | string | — |

## Rules and behaviour

- Matches TextField's exact border/height/radius/colors — for forms mixing selects and text fields, unlike Select's own native picker-button chrome.
- Opens @expo/ui's community MenuView on tap — the same native-menu primitive ContextMenu wraps.
- Shows a checkmark next to the currently-selected option in the menu.
- A chevron-down icon on the right signals it's a select, not a plain text field.

## Exports

`SelectFieldOption` · `SelectFieldProps` · `SelectField`

## Accessibility

Automated check: `packages/ui-native/src/components/select-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
