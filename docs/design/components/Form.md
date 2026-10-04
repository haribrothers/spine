# Form

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/form.tsx` · **Doc page:** `apps/design-system/src/app/components/form/page.tsx`

Provides client-side validation for forms, leveraging native constraint validation. For real submitted forms with required/pattern/match rules — e.g. a matrix-entry or org-structure create form. Exported as RadixFormField (not FormField) to avoid colliding with the simpler, non-validation FormField composition — that one remains the right choice for a single already-validated field outside a submitted form.

## Import

```tsx
import { Form, RadixFormField, FormLabel, FormControl, FormMessage, FormSubmit } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `RadixFormField.name` | string | — |
| `FormMessage.match` | 'valueMissing' \| 'typeMismatch' \| 'patternMismatch' \| … | — |

## Rules and behaviour

- Auto-generates accessible error messages using native HTML validation attributes.
- Collects data as native FormData on submit.
- Extensible with custom validation logic via a Match prop.

## Exports

`Form` · `RadixFormField` · `FormLabel` · `FormControl` · `FormMessage` · `FormSubmit` · `FormValidityState`

## Accessibility

Automated check: `packages/ui/src/components/form.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
