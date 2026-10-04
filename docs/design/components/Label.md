# Label

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/label.tsx` · **Doc page:** `apps/design-system/src/app/components/label/page.tsx`

Renders an accessible label associated with a control. The standalone primitive FormField composes internally — reach for FormField in almost every real screen rather than pairing Label and a control by hand, since FormField also wires up helper/error text and aria-describedby.

## Import

```tsx
import { Label } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `htmlFor` | string | — |

## Rules and behaviour

- Clicking the label focuses the associated control, same as a native &lt;label&gt;.
- Text selection is prevented on double-click, matching native label behavior.

## Exports

`Label`

## Accessibility

Automated check: `packages/ui/src/components/label.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
