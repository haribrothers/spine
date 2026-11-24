"use client";

import { createContext, useContext, useRef, useState } from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

interface ReorderableListContextValue {
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  overId: string | null;
  setOverId: (id: string | null) => void;
  /** Reorders `itemIds` so `draggedId` lands immediately before/after `targetId`, then reports the new order — only called when the order actually changes. */
  moveItem: (draggedId: string, targetId: string, dropBefore: boolean) => void;
}

const ReorderableListContext = createContext<ReorderableListContextValue | null>(null);

function useReorderableListContext(component: string) {
  const ctx = useContext(ReorderableListContext);
  if (!ctx) throw new Error(`${component} must be used within a ReorderableList`);
  return ctx;
}

export interface ReorderableListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {
  /** Ordered ids, matching each ReorderableItem's own `id` — this is what `onReorder` reports positions against. */
  itemIds: string[];
  /** Called with the full reordered id list once a drag completes and the order actually changed — never called for a drag that ends where it started. */
  onReorder: (newOrder: string[]) => void;
  children: React.ReactNode;
}

/**
 * Drag-to-reorder state/logic for a set of items — native HTML5 DnD, same
 * idiom as `KanbanBoard`/`KanbanCard` (`draggable` + `onDragStart`/
 * `onDragOver`/`onDrop`, drag state in a small context). Deliberately
 * layout-agnostic: `ReorderableList` renders its own `className` as the
 * container (a plain vertical list by default, but just as easily a CSS
 * grid — see `ReorderableItem`'s own doc comment on why it carries no
 * opinion about its children's internal layout either). No `@dnd-kit` or
 * other dependency — this codebase already has a working native DnD
 * pattern for the harder multi-column Kanban case; a flat reorder only
 * needs "compare pointer position against a sibling's own midpoint to
 * find an insert index," which reuses the same idiom.
 */
export function ReorderableList({ itemIds, onReorder, className, children, ...props }: ReorderableListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function moveItem(draggedItemId: string, targetId: string, dropBefore: boolean) {
    const fromIndex = itemIds.indexOf(draggedItemId);
    if (fromIndex === -1) return;

    const withoutDragged = itemIds.filter((id) => id !== draggedItemId);
    let targetIndex = withoutDragged.indexOf(targetId);
    if (targetIndex === -1) return;
    if (!dropBefore) targetIndex += 1;

    const next = [...withoutDragged.slice(0, targetIndex), draggedItemId, ...withoutDragged.slice(targetIndex)];
    const changed = next.some((id, i) => id !== itemIds[i]);
    if (changed) onReorder(next);
  }

  return (
    <ReorderableListContext.Provider value={{ draggedId, setDraggedId, overId, setOverId, moveItem }}>
      <div className={className} {...props}>
        {children}
      </div>
    </ReorderableListContext.Provider>
  );
}

export interface ReorderableItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id" | "onDrop"> {
  id: string;
  children: React.ReactNode;
}

/**
 * Drag/drop wiring for one item inside a `ReorderableList` — carries no
 * opinion about its own visual layout (no padding, no border, no flex
 * row) so it can wrap arbitrary content, e.g. a full dashboard widget
 * card, and still have that content's own styling read correctly.
 *
 * Drop position ("does the dragged item land before or after THIS item
 * in array order") is decided per-axis of the container, not a single
 * Y-midpoint check — a Y-only check is correct for a single-column list
 * (`KanbanColumn`'s own drop-zone technique, which inspired this) but
 * breaks once a grid has more than one column: array order and 2D visual
 * position diverge, so a Y-only check can't tell "drop to the right of
 * this card, same row" from "drop below this card, next row," and gets
 * diagonal drags wrong entirely (Y alone says nothing about column).
 *
 * The actual rule, read like text (left-to-right, top-to-bottom): a grid
 * with more than one column decides purely on X — the pointer's
 * horizontal position within THIS card's own bounds, left half = before,
 * right half = after — since a card's array neighbors in a wrapping grid
 * are its left/right siblings, not (usually) the card directly above or
 * below it. A single-column list has only one column, so every card
 * shares the same X and this collapses to the previous Y-only behavior
 * automatically. Column count is inferred once per drag from the
 * container's own children positions (do any two cards share a Y
 * coordinate?) rather than requiring the caller to declare it.
 */
export function ReorderableItem({ id, children, className, ...props }: ReorderableItemProps) {
  const ctx = useReorderableListContext("ReorderableItem");
  const rowRef = useRef<HTMLDivElement>(null);
  const dropBeforeRef = useRef(true);

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        ctx.setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        ctx.setDraggedId(null);
        ctx.setOverId(null);
      }}
      onDragOver={(e) => {
        if (!ctx.draggedId || ctx.draggedId === id) return;
        e.preventDefault();
        ctx.setOverId(id);
        const rect = rowRef.current?.getBoundingClientRect();
        if (!rect) {
          dropBeforeRef.current = true;
          return;
        }
        const container = rowRef.current?.parentElement;
        const isMultiColumn = container ? hasMultipleColumns(container) : false;
        dropBeforeRef.current = isMultiColumn ? e.clientX < rect.left + rect.width / 2 : e.clientY < rect.top + rect.height / 2;
      }}
      onDragLeave={() => {
        if (ctx.overId === id) ctx.setOverId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = ctx.draggedId;
        ctx.setDraggedId(null);
        ctx.setOverId(null);
        if (!draggedId || draggedId === id) return;
        ctx.moveItem(draggedId, id, dropBeforeRef.current);
      }}
      className={cn("transition-opacity", ctx.draggedId === id ? "opacity-40" : "", ctx.overId === id ? "outline outline-2 outline-primary outline-offset-2 rounded-lg" : "", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** True if any two direct children of `container` sit at the same top offset — i.e. the layout has more than one column (a grid), not a single stacked column. Checked fresh per dragover rather than cached, since it's a cheap DOM read and the caller's layout can change (e.g. a responsive breakpoint collapsing a grid to one column). */
function hasMultipleColumns(container: Element): boolean {
  const children = Array.from(container.children);
  const tops = new Set<number>();
  for (const child of children) {
    const top = Math.round(child.getBoundingClientRect().top);
    if (tops.has(top)) return true;
    tops.add(top);
  }
  return false;
}

/** Reads this specific item's own drag state — for a child that wants to render a "dragging"/"drop target" visual itself, instead of relying on ReorderableItem's own default outline treatment. */
export function useReorderableItemDragState(id: string) {
  const ctx = useReorderableListContext("useReorderableItemDragState");
  return { isDragging: ctx.draggedId === id, isOver: ctx.overId === id };
}

export interface DragHandleProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Size in px, passed to the GripVertical icon. Default 14. */
  size?: number;
}

/** A grab-cursor grip icon — purely visual/cursor affordance, since the whole ReorderableItem is draggable regardless of where the pointer starts (native HTML5 DnD has no way to restrict the drag origin to a sub-element without extra plumbing this doesn't need yet). */
export function DragHandle({ size = 14, className, ...props }: DragHandleProps) {
  return (
    <span className={cn("cursor-grab text-on-surface-muted active:cursor-grabbing", className)} aria-hidden="true" {...props}>
      <GripVertical size={size} />
    </span>
  );
}

export interface HideToggleProps {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
}

/** An eye/eye-off icon button toggling a widget's visibility — shared visual between the row-list layout and the card-overlay layout. */
export function HideToggle({ hidden, onToggle, className }: HideToggleProps) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("text-on-surface-muted hover:text-on-surface", className)}
      aria-label={hidden ? t("ui.reorderableList.showWidget") : t("ui.reorderableList.hideWidget")}
    >
      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
