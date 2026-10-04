# Toolbar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/toolbar.tsx` · **Doc page:** `apps/design-system/src/app/components/toolbar/page.tsx`

A container for grouping a set of controls, such as buttons, toggle groups, or dropdown menus.

## Import

```tsx
import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarLink, ToolbarToggleGroup, ToolbarToggleItem } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `orientation` | horizontal \| vertical | horizontal |

## Rules and behaviour

- Supports horizontal and vertical orientation.
- Full keyboard navigation with roving tabindex across all toolbar controls.

## Exports

`Toolbar` · `ToolbarButton` · `ToolbarSeparator` · `ToolbarLink` · `ToolbarToggleGroup` · `ToolbarToggleItem`

## Accessibility

Automated check: `packages/ui/src/components/toolbar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
