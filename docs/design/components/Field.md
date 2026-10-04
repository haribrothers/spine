# Field

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/field.tsx` · **Doc page:** `apps/design-system/src/app/components/field/page.tsx`

A richer layout primitive for grouping multiple FormFields — e.g. a two-column address block, or a fieldset with a legend. Distinct from FormField, which wires up a single label/control/helper-text triplet; Field/FieldGroup/FieldSet only handle layout.

## Import

```tsx
import { Field, FieldGroup, FieldSet, FieldLegend, FieldDescription } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard <div>/<fieldset>/<legend>/<p> attributes on the respective sub-parts | — |

## Rules and behaviour

- FieldGroup lays out its children in a responsive 2-column grid.
- FieldSet renders a real &lt;fieldset&gt;/&lt;legend&gt; pair for grouped, semantically related fields.

## Exports

`Field` · `FieldGroup` · `FieldSet` · `FieldLegend` · `FieldDescription`

## Accessibility

Automated check: `packages/ui/src/components/field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
