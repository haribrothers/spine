"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "../lib/cn";
import { ScrollArea } from "./scroll-area";

interface KanbanContextValue {
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
}

const KanbanContext = createContext<KanbanContextValue | null>(null);

function useKanbanContext(component: string) {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error(`${component} must be used within a KanbanBoard`);
  return ctx;
}

export interface KanbanBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** KanbanColumn children — the board lays them out in a row and never scrolls vertically itself; only each column's own card list does (see KanbanColumn). The row of columns can still scroll horizontally if they overflow the viewport width. */
  children: React.ReactNode;
}

/**
 * A domain-agnostic drag-and-drop board: columns laid out in a fixed-height
 * row, cards draggable between columns via native HTML5 DnD. Fills its
 * parent's height (`h-full`) rather than computing a viewport-relative
 * height itself — the caller's layout determines how tall "full" is (e.g.
 * this app's AppShell main area is already its own fixed-height scroll
 * container), so nesting this inside a `flex min-h-0 flex-col` ancestor is
 * what makes "the board doesn't scroll, only cards inside a column do"
 * hold in practice. Carries only drag state (which card id is being
 * dragged) via context; column membership, counts, and persistence are
 * entirely the caller's concern (KanbanColumn's `onDrop` receives the
 * dragged card's id and does whatever a move means for its data — e.g. a
 * PUT request).
 */
export function KanbanBoard({ className, children, ...props }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  return (
    <KanbanContext.Provider value={{ draggedId, setDraggedId }}>
      <div className={cn("flex h-full min-h-0 items-stretch gap-4 overflow-x-auto pb-2", className)} {...props}>
        {children}
      </div>
    </KanbanContext.Provider>
  );
}

export interface KanbanColumnProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop" | "title"> {
  title: React.ReactNode;
  /** Shown next to the title, typically a count. */
  meta?: React.ReactNode;
  /** Shown below the title, e.g. a running value total. */
  subtitle?: React.ReactNode;
  /** Called with the dragged card's id when a card is dropped on this column. No-op (e.g. dropping back on the origin column) is the caller's responsibility to detect. */
  onDrop?: (cardId: string) => void;
  /** Fixed column width; defaults to a comfortable card width. */
  width?: number;
  children?: React.ReactNode;
}

/**
 * One column of a KanbanBoard. The column chrome (header, border) has a
 * fixed height (100% of the board's own height) and never scrolls; only
 * its card list does, via ScrollArea, per this component's own design: a
 * pipeline with many cards in one stage must not push the whole page into
 * a tall scroll.
 */
export function KanbanColumn({
  title,
  meta,
  subtitle,
  onDrop,
  width = 272,
  className,
  children,
  ...props
}: KanbanColumnProps) {
  const { draggedId, setDraggedId } = useKanbanContext("KanbanColumn");
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full min-h-[360px] flex-col rounded-lg border transition-colors",
        isOver ? "border-primary bg-info-bg" : "border-border bg-surface-sunken",
        className,
      )}
      style={{ width, flex: `0 0 ${width}px` }}
      onDragOver={(e) => {
        if (!draggedId) return;
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        if (draggedId) onDrop?.(draggedId);
        setDraggedId(null);
      }}
      {...props}
    >
      <div className="flex flex-col gap-0.5 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-on-surface">{title}</h3>
          {meta !== undefined && <span className="text-[12px] text-on-surface-muted">{meta}</span>}
        </div>
        {subtitle !== undefined && <div className="text-[12px] text-on-surface-muted">{subtitle}</div>}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <div className="flex flex-col gap-2">{children}</div>
      </ScrollArea>
    </div>
  );
}

export interface KanbanCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  id: string;
  children: React.ReactNode;
}

/** A draggable card inside a KanbanColumn. `onClick` is free for the caller to use (e.g. opening an edit dialog) since drag and click are distinguished natively by the browser's own drag threshold. */
export function KanbanCard({ id, className, children, onDragStart, onDragEnd, ...props }: KanbanCardProps) {
  const { setDraggedId } = useKanbanContext("KanbanCard");

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        setDraggedId(null);
        onDragEnd?.(e);
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-md border border-border-strong bg-surface p-3 text-[13px] shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
