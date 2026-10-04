# FormField

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/form-field.tsx` · **Doc page:** `apps/design-system/src/app/components/form-field/page.tsx`

Label above, control, helper/error text below — the composition every form control in the app should be built from, rather than hand-wiring Label/HelperText/aria attributes per screen.

## Import

```tsx
import { FormField } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `label` | string | — |
| `helperText` | string | — |
| `errorText` | string | — |
| `required` | boolean | false |
| `children` | (field: { id, 'aria-describedby', 'aria-invalid', 'aria-required', required }) => ReactNode | — |

## Rules and behaviour

- A render-prop child receives the field's generated id, aria-describedby, aria-invalid, aria-required, and required, ready to spread onto any control.
- Automatically links helper or error text to the control via aria-describedby, and sets aria-invalid when errorText is present.
- A required prop renders an asterisk after the label (aria-hidden, decorative only) and passes required/aria-required through to the control itself, so requiredness is announced from the control, not just implied by a visual mark.

## Exports

`FormFieldRenderProps` · `FormFieldProps` · `FormField`

## Accessibility

Automated check: `packages/ui/src/components/form-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
