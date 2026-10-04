# ToggleGroup

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/toggle-group.tsx` · **Doc page:** `apps/design-system/src/app/components/toggle-group/page.tsx`

A set of two-state buttons that can be toggled on or off — a single-select icon row, e.g. a document view switcher.

## Import

```tsx
import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `type` | single \| multiple | — |
| `value` | string \| string[] | — |
| `onValueChange` | (value: string \| string[]) => void | — |

## Rules and behaviour

- Supports single or multiple selection.
- Full keyboard navigation, roving tabindex.

## Exports

`ToggleGroup` · `ToggleGroupItem`

## Accessibility

Automated check: `packages/ui/src/components/toggle-group.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
