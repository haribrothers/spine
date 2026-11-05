# Dialog

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/dialog.tsx` · **Doc page:** `apps/design-system/src/app/components/dialog/page.tsx`

A window overlaid on the page, rendering content that requires focused attention. A focused, centered task — e.g. confirming a void. For a longer side-anchored flow, use Drawer instead.

## Import

```tsx
import { Dialog, DialogTrigger, DialogClose, DialogOverlay, DialogContent, DialogHeader } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` | boolean | — |
| `onOpenChange` | (open: boolean) => void | — |
| `modal` | boolean | true |
| `asChild` | boolean | false |
| `onOpenAutoFocus` | (event: Event) => void | — |
| `onCloseAutoFocus` | (event: Event) => void | — |
| `onEscapeKeyDown` | (event: KeyboardEvent) => void | — |
| `onPointerDownOutside` | (event: PointerDownOutsideEvent) => void | — |
| `asChild` | boolean | false |

## Rules and behaviour

- Full keyboard navigation.
- Under 768px, md and lg fill the screen width with a 16px gutter each side (US-OPS-15); xl takes the whole screen there (D-236).
- Supports modal and non-modal modes.
- Manages screen reader announcements with Title and Description components.
- Focus is fully managed and customizable.
- The overlay dims the page and blocks interaction while open.

## Exports

`Dialog` · `DialogTrigger` · `DialogClose` · `DialogOverlay` · `DialogContentProps` · `DialogContent` · `DialogHeader` · `DialogBody` · `DialogTitle` · `DialogDescription` · `DialogFooter`

## Accessibility

Automated check: `packages/ui/src/components/dialog.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
