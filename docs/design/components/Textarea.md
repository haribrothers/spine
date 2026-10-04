# Textarea

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/textarea.tsx` · **Doc page:** `apps/design-system/src/app/components/textarea/page.tsx`

A multi-line text field — quote terms, job notes, expense descriptions.

## Import

```tsx
import { Textarea } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `error` | boolean | false |
| `…` | standard <textarea> attributes | — |

## Rules and behaviour

- Renders a native &lt;textarea&gt;, so rows, maxLength, and other native attributes pass through.
- Shares Input's border, radius, and focus-ring treatment so the two feel like one family in a form.

## Exports

`TextareaProps` · `Textarea`

## Accessibility

Automated check: `packages/ui/src/components/textarea.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
