# PasswordToggleField

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/password-toggle-field.tsx` · **Doc page:** `apps/design-system/src/app/components/password-toggle-field/page.tsx`

A password field with a control for toggling its visibility — genuinely useful for Spine's own sign-up/login screens (§5's email+password auth).

## Import

```tsx
import { PasswordToggleField, PasswordToggleFieldInput, PasswordToggleFieldToggle } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `defaultVisible` | boolean | false |

## Rules and behaviour

- Toggling visibility does not clear the field or move the caret unexpectedly.
- The eye/eye-off icon swaps automatically via PasswordToggleFieldIcon.

## Exports

`PasswordToggleField` · `PasswordToggleFieldInput` · `PasswordToggleFieldToggle`

## Accessibility

Automated check: `packages/ui/src/components/password-toggle-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
