# NativeTextField

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/native-text-field.tsx` · **Doc page:** `apps/design-system-native/app/components/native-text-field.tsx`

A genuinely native iOS text field, built directly from Apple&apos;s own SwiftUI `TextField` API — colored with this design system&apos;s own tokens, not the system default. iOS only; there is no Android equivalent of this component.

## Import

```tsx
import { NativeTextField } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | string | — |
| `onChangeText` | (text: string) => void | — |
| `placeholder` | string | — |
| `error` | boolean | false |
| `disabled` | boolean | false |
| `multiline` | boolean | false |

## Rules and behaviour

- A real SwiftUI TextField (via @expo/ui's swift-ui bridge) — real system text editing: native selection handles, cut/copy/paste/lookup menu, autofill, Live Text/QuickType.
- Every color (background, border, error state, disabled) is resolved from this package's own design tokens, never the system default.
- A controlled component (value/onChangeText), like TextField — internally bridges to @expo/ui's observable-state API so the two share the same call-site shape.

## Exports

`NativeTextFieldProps` · `NativeTextField`

## Accessibility

Automated check: `packages/ui-native/src/components/native-text-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
