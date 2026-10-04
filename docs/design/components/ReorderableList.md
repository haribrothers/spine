# ReorderableList

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/reorderable-list.tsx` · **Doc page:** `apps/design-system/src/app/components/reorderable-list/page.tsx`

Drag-to-reorder state and wiring — native HTML5 drag-and-drop, the same idiom KanbanBoard/ KanbanCard already use (draggable + drag-state-in-context). Deliberately layout-agnostic: ReorderableList renders whatever container class you give it (a flex column, a CSS grid — the dashboard uses this to drag real widget cards in place, not a separate text list), and ReorderableItem wraps arbitrary children with no imposed visual style of its own.

## Import

```tsx
import { ReorderableList, ReorderableItem, DragHandle, HideToggle } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `ReorderableList.itemIds` | string[] | — |
| `ReorderableList.onReorder` | (newOrder: string[]) => void | — |
| `ReorderableList.className` | string | — |
| `ReorderableItem.id` | string | — |
| `ReorderableItem.className` | string | — |
| `useReorderableItemDragState(id)` | { isDragging, isOver } | — |
| `DragHandle` | component | — |
| `HideToggle` | component | — |

## Rules and behaviour

- Container layout is entirely the caller's — a grid of cards (dashboard widgets) or a plain vertical list, both shown on this page.
- Drop position adapts to the container's own layout — a single-column list decides before/after by vertical (Y) midpoint; a multi-column grid decides by horizontal (X) midpoint instead, since a grid's array neighbors are its left/right siblings, not the card above/below. Detected automatically per drag, no layout prop to set.
- DragHandle and HideToggle are small shared visual primitives — use them, or roll your own controls entirely.
- useReorderableItemDragState(id) reads one item's own isDragging/isOver so a child can render its own drag feedback instead of relying on ReorderableItem's default outline.
- onReorder only fires when the order actually changed, never for a drag that ends where it started.

## Exports

`ReorderableListProps` · `ReorderableList` · `ReorderableItemProps` · `ReorderableItem` · `useReorderableItemDragState` · `DragHandleProps` · `DragHandle` · `HideToggleProps` · `HideToggle`

## Accessibility

Automated check: `packages/ui/src/components/reorderable-list.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
