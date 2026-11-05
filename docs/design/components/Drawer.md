# Drawer

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/drawer.tsx` · **Doc page:** `apps/design-system/src/app/components/drawer/page.tsx`

A panel that slides in from an edge of the screen. Same underlying primitive as Dialog — full-height and anchored to an edge instead of centered. Used for a longer flow, e.g. a quote's line-item editor.

## Import

```tsx
import { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerBody } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `DrawerContent.side` | left \| right | right |
| `DrawerContent.size` | sm \| md \| lg | md |

## Rules and behaviour

- Anchors to the left or right edge via the side prop on DrawerContent.
- Under 768px it fills the screen width but leaves a 16px gutter of the dimmed page on its open side (US-OPS-15).
- Three widths via the size prop on DrawerContent — sm, md (default), lg — same naming convention as Dialog's size prop.
- DrawerHeader and DrawerFooter are fixed (shrink-0) and never scroll; DrawerBody is the only scrollable region, so a tall form's header/footer stay pinned while its middle content scrolls.
- Same focus-trap and Escape-to-close behavior as Dialog.
- Renders above Dialog/Drawer content at the z-modal tier — a Select or DropdownMenu opened from inside a Drawer correctly renders above it, at the z-popover tier.

## Exports

`Drawer` · `DrawerTrigger` · `DrawerClose` · `DrawerContentProps` · `DrawerContent` · `DrawerHeader` · `DrawerBody` · `DrawerTitle` · `DrawerDescription` · `DrawerFooter`

## Accessibility

Automated check: `packages/ui/src/components/drawer.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
