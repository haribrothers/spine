# Kanban

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/kanban.tsx` · **Doc page:** `apps/design-system/src/app/components/kanban/page.tsx`

A domain-agnostic drag-and-drop board — KanbanBoard, KanbanColumn and KanbanCard — for any stage-based pipeline (leads by stage today; a future jobs or hiring board could reuse the same three pieces). Built on native HTML5 drag-and-drop rather than a dependency, since a handful of columns and cards doesn't need a full DnD library. The board itself never scrolls — only each column's card list does — so a column with many cards never pushes the whole board taller than its container.

## Import

```tsx
import { KanbanBoard, KanbanColumn, KanbanCard } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `KanbanBoard children` | ReactNode | — |
| `KanbanColumn title` | ReactNode | — |
| `KanbanColumn meta` | ReactNode | — |
| `KanbanColumn subtitle` | ReactNode | — |
| `KanbanColumn onDrop` | (cardId: string) => void | — |
| `KanbanColumn width` | number | — |
| `KanbanColumn minWidth` | number | 275 |
| `KanbanCard id` | string | — |
| `KanbanCard onClick` | () => void | — |

## Rules and behaviour

- Drag a card from one column and drop it on another to move it — KanbanColumn's onDrop receives the dragged card's id; what a "move" means (a PUT request, local state, etc.) is entirely the caller's concern.
- Each column has a fixed height (100% of the board) and its own independently scrolling card list via ScrollArea — the board's overall height never grows with card count.
- title/meta/subtitle are free-form ReactNode, not fixed to "name + count" — meta is typically a count, subtitle a running value total, but neither is required.
- A column being dragged over highlights (border-primary + bg-info-bg) so the drop target is obvious; a column can also take its own className to signal a distinct state (e.g. a "Lost" stage tinted with the overdue tokens).
- KanbanCard's onClick is untouched by drag handling (native drag/click are distinguished by the browser's own movement threshold), so cards can open an edit dialog on click while still being draggable.
- Columns flex to fill the board's full width by default (floored at minWidth, 275px) — a handful of stages spread out to use all available space with no unnecessary scrolling; pass a fixed width to opt a column out of flexing instead.

## Exports

`KanbanBoardProps` · `KanbanBoard` · `KanbanColumnProps` · `KanbanColumn` · `KanbanCardProps` · `KanbanCard`

## Accessibility

Automated check: `packages/ui/src/components/kanban.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
