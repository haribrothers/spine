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
| `KanbanColumn accent` | ReactNode | — |
| `KanbanColumn headerAction` | ReactNode | — |
| `KanbanColumn collapsed` | boolean | false |
| `KanbanColumn onExpand` | () => void | — |
| `KanbanColumn expandLabel` | string | — |
| `KanbanCard onClick` | () => void | — |
| `KanbanCard onOpen` | () => void | — |
| `KanbanCard label` | string | — |
| `KanbanCard menu` | ReactNode | — |
| `KanbanCard onMenuKey` | () => void | — |

## Rules and behaviour

- `KanbanStack` (US-OPS-56): one column's cards one under another, with the board's context, for a phone that shows one stage at a time; cards move from their menu there.
- Drag a card from one column and drop it on another to move it — KanbanColumn's onDrop receives the dragged card's id; what a "move" means (a PUT request, local state, etc.) is entirely the caller's concern.
- Each column has a fixed height (100% of the board) and its own independently scrolling card list via ScrollArea — the board's overall height never grows with card count.
- title/meta/subtitle are free-form ReactNode, not fixed to "name + count" — meta is typically a count, subtitle a running value total, but neither is required.
- A column being dragged over highlights (border-primary + bg-info-bg) so the drop target is obvious; a column can also take its own className to signal a distinct state (e.g. a "Lost" stage tinted with the overdue tokens).
- KanbanCard's onClick is untouched by drag handling (native drag/click are distinguished by the browser's own movement threshold), so cards can open an edit dialog on click while still being draggable.
- Columns flex to fill the board's full width by default (floored at minWidth, 275px) — a handful of stages spread out to use all available space with no unnecessary scrolling; pass a fixed width to opt a column out of flexing instead.
- US-CRM-24: `collapsed` makes a slim (56 px), full-height column that is one button, showing `accent`, `meta`, the title and `subtitle` running upwards; pressing it calls `onExpand`, and cards can still be dropped on it. `headerAction` puts a control (e.g. "Hide") at the right of an open column's header.
- US-CRM-24: when the columns overflow sideways, a soft shadow (the `scrim` token) at the edge with more says so; the board carries `data-more-start` / `data-more-end`.
- US-CRM-25: with `onOpen` the whole card is one focusable button (`role="button"`, named by `label`): click, Enter or Space opens it. `menu` sits beside that button at the top right, never inside it (keep the card's first line clear of it, e.g. `pr-7` on the title, so rules below run the full width); `onMenuKey` fires on the menu key or Shift+F10. Long unbroken text no longer widens a column.

## Exports

`KanbanBoardProps` · `KanbanBoard` · `KanbanColumnProps` · `KanbanColumn` · `KanbanCardProps` · `KanbanCard`

## Accessibility

Automated check: `packages/ui/src/components/kanban.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
