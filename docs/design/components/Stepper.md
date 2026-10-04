# Stepper

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/stepper.tsx` · **Doc page:** `apps/design-system/src/app/components/stepper/page.tsx`

A numbered progress indicator for linear multi-step flows — wizards, checkout-style forms. Numbered circles connected by a line, a checkmark on completed steps, the current step highlighted. Promoted from the onboarding wizard (F12), its original and still only call site.

## Import

```tsx
import { StepperStepDef, Stepper } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `steps` | { key: string; label: string }[] | — |
| `currentIndex` | number | — |
| `className` | string | — |

## Rules and behaviour

- Numbered circles for upcoming/current steps, a checkmark (lucide's Check) for completed ones.
- A connecting line between steps fills the same border-strong token as the un-reached circle border.
- The current step's label is medium-weight and full-opacity; other labels are muted.
- Step labels hide below the sm breakpoint, leaving just the numbered/checked circles for narrow viewports.
- Purely presentational — indicates progress, it is not a set of interactive controls.

## Exports

`StepperStepDef` · `StepperProps` · `Stepper`

## Accessibility

Automated check: `packages/ui/src/components/stepper.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
