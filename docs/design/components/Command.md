# Command

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/command.tsx` · **Doc page:** `apps/design-system/src/app/components/command/page.tsx`

A searchable command list. Standalone primitive — Combobox composes it with a Popover, and the design system's own ⌘K search palette composes it with a Dialog via CommandDialog.

## Import

```tsx
import { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `CommandItem.value` | string | — |
| `CommandItem.onSelect` | (value: string) => void | — |

## Rules and behaviour

- Fuzzy, type-to-filter search across items and groups.
- Full keyboard navigation.
- Composable into a Combobox trigger or a full-screen CommandDialog.

## Exports

`Command` · `CommandDialog` · `CommandInput` · `CommandList` · `CommandEmpty` · `CommandGroup` · `CommandSeparator` · `CommandItem` · `CommandShortcut`

## Accessibility

Automated check: `packages/ui/src/components/command.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
