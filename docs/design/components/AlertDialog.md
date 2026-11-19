# AlertDialog

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/alert-dialog.tsx` · **Doc page:** `apps/design-system/src/app/components/alert-dialog/page.tsx`

A modal dialog that interrupts the user with important content and expects a response — used specifically for critical/destructive actions (voiding an invoice, deleting a station) that can't be undone. Unlike Dialog, always renders an explicit Cancel action alongside the primary one.

## Import

```tsx
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` | boolean | — |
| `onOpenChange` | (open: boolean) => void | — |

## Rules and behaviour

- On a phone it stays a small alert in the middle of the screen, its buttons full width and stacked, the action on top (US-OPS-60).
- Focus is trapped and automatically managed.
- Under 768px it fills the screen width with a 16px gutter each side (US-OPS-15).
- Can be controlled or uncontrolled.
- Requires an explicit AlertDialogAction or AlertDialogCancel choice — the overlay does not close on outside click, unlike Dialog.

## Exports

`AlertDialog` · `AlertDialogTrigger` · `AlertDialogContent` · `AlertDialogHeader` · `AlertDialogTitle` · `AlertDialogDescription` · `AlertDialogFooter` · `AlertDialogCancel` · `AlertDialogAction`

## Accessibility

Automated check: `packages/ui/src/components/alert-dialog.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
