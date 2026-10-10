# Toggle

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/toggle.tsx` · **Doc page:** `apps/design-system/src/app/components/toggle/page.tsx`

A two-state button that can be either on or off — e.g. a rich-text formatting control. Visually similar to Button but tracks on/off state rather than firing an action.

## Import

```tsx
import { Toggle } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `pressed` | boolean | — |
| `defaultPressed` | boolean | — |
| `onPressedChange` | (pressed: boolean) => void | — |
| `size` | default \| sm | default |
| `tooltip` | string \| false | the `aria-label` of an icon-only toggle |

## Variants

- `size`: `default`, `sm`

## Rules and behaviour

- Can be controlled or uncontrolled.
- Supports disabled state.

- On is a light primary tint (`info-bg`) with a `primary` outline (US-OPS-36), not only a coloured icon.
- `tooltip`: an icon-only toggle shows its `aria-label` as a tooltip on hover and focus; `tooltip={false}` turns it off.

## Exports

`toggleVariants` · `ToggleProps` · `Toggle`

## Accessibility

Automated check: `packages/ui/src/components/toggle.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
