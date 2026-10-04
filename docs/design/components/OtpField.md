# OtpField

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/otp-field.tsx` · **Doc page:** `apps/design-system/src/app/components/otp-field/page.tsx`

A one-time password/passcode field with individually boxed digit inputs. Not currently used anywhere in Spine's auth flow — email+password plus an org invite per §5/§10.3, with no OTP step — included in the catalogue for completeness.

## Import

```tsx
import { OTPField, OTPFieldInput, OTPFieldHiddenInput } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `OTPField.value` | string | — |
| `OTPField.onValueChange` | (value: string) => void | — |
| `OTPFieldInput` | one per digit position, order-dependent | — |

## Rules and behaviour

- Handles paste — pasting a full code fills every box at once.
- Auto-advances focus to the next box as digits are typed.
- Backed by a single hidden &lt;input&gt; so the field still submits as one value inside a native &lt;form&gt;.

## Exports

`OTPField` · `OTPFieldInput` · `OTPFieldHiddenInput`

## Accessibility

Automated check: `packages/ui/src/components/otp-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
