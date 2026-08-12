"use client";

import { createContext, useContext, useRef, useState } from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";

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
 * card, and still have that content's own styling read correctly. Drop
 * position is computed from pointer Y vs. this element's own vertical
 * midpoint — the same "compare against a midpoint" technique
 * `KanbanColumn` already uses for its own drop-zone detection.
 *
 * Use `useReorderableItemDragState(id)` inside a child to read this
 * item's own `isDragging`/`isOver` for visual feedback (a ghost/drop-line
 * treatment), rather than this wrapper imposing one fixed look.
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
        dropBeforeRef.current = rect ? e.clientY < rect.top + rect.height / 2 : true;
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
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("text-on-surface-muted hover:text-on-surface", className)}
      aria-label={hidden ? "Show widget" : "Hide widget"}
    >
      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
