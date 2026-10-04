# Button

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/button.tsx` · **Doc page:** `apps/design-system/src/app/components/button/page.tsx`

Triggers an action or event. One primary (filled) action per screen — everything else is secondary, ghost, or a plain link.

## Import

```tsx
import { Button } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `variant` | primary \| secondary \| danger \| ghost | primary |
| `size` | default \| sm \| touch \| icon | default |
| `asChild` | boolean | false |
| `disabled` | boolean | false |

## Variants

- `variant`: `primary`, `secondary`, `danger`, `ghost`
- `size`: `default`, `sm`, `touch`, `icon`

## Rules and behaviour

- Renders a native &lt;button&gt; or, via asChild, forwards its props onto a single child element (e.g. a Link).
- Four visual variants: primary, secondary, danger, ghost.
- Four sizes, including a 44px touch size for the mobile field-companion app.
- Full keyboard and focus-visible support inherited from the native element.

## Exports

`buttonVariants` · `ButtonProps` · `Button`

## Accessibility

Automated check: `packages/ui/src/components/button.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
