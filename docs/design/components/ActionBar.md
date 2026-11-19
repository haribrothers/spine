# ActionBar

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/action-bar.tsx` · **Doc page:** `apps/design-system/src/app/components/action-bar/page.tsx` · **Stories:** US-OPS-58, US-OPS-59

The bar at the bottom of a record on a phone: the main action for the record's state as a full-width button, with ⋯ in the top bar for the rest (D-283).

**Status:** built (US-OPS-58); record pages wrap their main button in it. A builder's bar on a phone (its total, ⋯ and main button) is `DocumentBuilderBar`'s phone layout in `apps/web` (US-OPS-59), not this component.

## Import

```tsx
import { ActionBar, ActionBarSlot } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `children` | the record's one main `Button` (Send reminder, Issue invoice, Record payment, Invoice a milestone) | — |
| `className` | string — extra classes for the bar on a phone | — |

`ActionBarSlot` takes only `className`. The app shell renders it once, between `<main>` and the tab bar.

## Rules and behaviour

- From 768px up it renders its child where it was. Under 768px it renders into the shell's `ActionBarSlot` (`[data-action-bar-slot]`) as a 48px full-width button on the surface colour with a top border, so it never covers the page's last lines. Without a slot (a doc page) it's fixed to the bottom of the screen.
- One primary button; the record's other actions go under the top bar's ⋯ (`usePhoneRecordMenu` in `apps/web/src/lib/phone-bar.tsx`), opened as an action sheet.
- The slot steps aside with the tab bar while a full-screen dialog is open or, on a touch screen, while a text field has focus (the keyboard is up).
- No main action for the record's state (a void invoice): no bar.

## Accessibility

Automated check: `packages/ui/src/components/action-bar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply. The bar comes after the page in reading order, before the tab bar.
