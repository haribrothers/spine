# TextField

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/text-field.tsx` · **Doc page:** `apps/design-system-native/app/components/text-field.tsx`

A single-line text input, 44px height — mirrors packages/ui&apos;s Input, but on RN&apos;s TextInput. Always pair with a visible label above it, never placeholder-only.

## Import

```tsx
import { TextField } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `error` | boolean | false |
| `…` | standard TextInputProps | — |

## Rules and behaviour

- Renders RN's TextInput, so all native TextInputProps (keyboardType, autoComplete, secureTextEntry, …) pass through.
- An error prop switches the border to the overdue color, paired with a screen's own inline error text.
- 44px height, matching the touch-size Button — consistent minimum touch target across the library.

## Exports

`TextFieldProps` · `TextField`

## Accessibility

Automated check: `packages/ui-native/src/components/text-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
