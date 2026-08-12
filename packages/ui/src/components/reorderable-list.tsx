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
 * A single flat drag-to-reorder list — native HTML5 DnD, same idiom as
 * `KanbanBoard`/`KanbanCard` (`draggable` + `onDragStart`/`onDragOver`/
 * `onDrop`, drag state in a small context), adapted for one container
 * instead of many drop-target columns. No `@dnd-kit` or other dependency:
 * this codebase already has a working native DnD pattern for the harder
 * multi-column case (Kanban), so a single-list reorder — which only needs
 * "compare pointer Y against sibling midpoints to find an insert index,"
 * not cross-container drop-target logic — reuses that idiom rather than
 * introducing a second one. Extracted for S-09.13 (dashboard v2's
 * per-user widget reordering), the first consumer.
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
      <div className={cn("flex flex-col gap-1", className)} {...props}>
        {children}
      </div>
    </ReorderableListContext.Provider>
  );
}

export interface ReorderableItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id" | "onDrop"> {
  id: string;
  /** Rendered before the drag handle and hide/show toggle — typically a short label identifying the item. */
  children: React.ReactNode;
  hidden?: boolean;
  onToggleHidden?: () => void;
}

/**
 * One row inside a `ReorderableList`. Drop position is computed from
 * pointer Y vs. this row's own vertical midpoint (`onDragOver`) — dropping
 * in the top half inserts before this row, the bottom half inserts after
 * — the same "compare against a midpoint" technique `KanbanColumn` already
 * uses for its own drop-zone detection, applied here to ordering within
 * one list instead of column membership.
 */
export function ReorderableItem({ id, children, hidden = false, onToggleHidden, className, ...props }: ReorderableItemProps) {
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
      className={cn(
        "flex items-center gap-2 rounded-sm border px-2 py-2 text-[13px] transition-colors",
        ctx.overId === id ? "border-primary bg-primary/5" : "border-border-strong bg-surface",
        ctx.draggedId === id ? "opacity-50" : "",
        hidden ? "opacity-60" : "",
        className,
      )}
      {...props}
    >
      <span className="cursor-grab text-on-surface-muted active:cursor-grabbing" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className={cn("flex-1", hidden ? "text-on-surface-muted" : "text-on-surface")}>{children}</span>
      {onToggleHidden && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="text-on-surface-muted hover:text-on-surface"
          aria-label={hidden ? "Show widget" : "Hide widget"}
        >
          {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}
