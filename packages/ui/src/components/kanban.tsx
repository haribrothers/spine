"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
 *
 * US-CRM-24 (D-211): when the columns overflow sideways, a soft shadow at
 * the edge that has more (`data-more-start` / `data-more-end`) says so.
 */
export function KanbanBoard({ className, children, ...props }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMore((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <KanbanContext.Provider value={{ draggedId, setDraggedId }}>
      <div className={cn("relative h-full min-h-0", className)} data-more-start={more.start || undefined} data-more-end={more.end || undefined}>
        <div ref={scroller} onScroll={measure} className="flex h-full min-h-0 items-stretch gap-3 overflow-x-auto pb-2" {...props}>
          {children}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-scrim to-transparent transition-opacity motion-reduce:transition-none",
            more.start ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-scrim to-transparent transition-opacity motion-reduce:transition-none",
            more.end ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </KanbanContext.Provider>
  );
}

export interface KanbanColumnProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop" | "title"> {
  title: React.ReactNode;
  /** Shown before the title, e.g. a colour dot. */
  accent?: React.ReactNode;
  /** Shown next to the title, typically a count. */
  meta?: React.ReactNode;
  /** Shown below the title, e.g. a running value total. */
  subtitle?: React.ReactNode;
  /** Shown at the right of the header, e.g. a button that collapses the column. */
  headerAction?: React.ReactNode;
  /** Called with the dragged card's id when a card is dropped on this column. No-op (e.g. dropping back on the origin column) is the caller's responsibility to detect. */
  onDrop?: (cardId: string) => void;
  /**
   * US-CRM-24 — a slim, full-height column (56 px) showing the accent, the
   * meta, the title and the subtitle running upwards. Pressing it calls
   * `onExpand`; cards can still be dropped on it. `children` aren't shown.
   */
  collapsed?: boolean;
  onExpand?: () => void;
  /** The collapsed column's accessible name, e.g. "Show Won, 3 leads". */
  expandLabel?: string;
  /**
   * Fixed column width in px. When set, the column never grows/shrinks
   * (`flex: 0 0 <width>px`) — use this for a board with many columns where
   * a consistent card width matters more than fitting the viewport.
   * When omitted (the default), the column instead flexes to fill the
   * board's row (`flex: 1 1 0`, floored at `minWidth`) so a handful of
   * columns spread out to use the full available width with no
   * unnecessary horizontal scroll — falling back to the board's own
   * `overflow-x-auto` only once columns would drop below that floor.
   */
  width?: number;
  /** Floor width in px when `width` is omitted (flexible mode). Ignored if `width` is set. */
  minWidth?: number;
  children?: React.ReactNode;
}

const DEFAULT_MIN_WIDTH = 275;
const COLLAPSED_WIDTH = 56;

/**
 * One column of a KanbanBoard. The column chrome (header, border) has a
 * fixed height (100% of the board's own height) and never scrolls; only
 * its card list does, via ScrollArea, per this component's own design: a
 * pipeline with many cards in one stage must not push the whole page into
 * a tall scroll.
 */
/**
 * US-OPS-56 (D-283) — one column's cards one under another, for a phone that shows one stage
 * at a time. It gives the cards the board's context, so their menus and opening work as on the
 * board; cards move between stages from their menu, not by dragging.
 */
export function KanbanStack({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  return (
    <KanbanContext.Provider value={{ draggedId, setDraggedId }}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </KanbanContext.Provider>
  );
}

export function KanbanColumn({
  title,
  accent,
  meta,
  subtitle,
  headerAction,
  onDrop,
  collapsed = false,
  onExpand,
  expandLabel,
  width,
  minWidth = DEFAULT_MIN_WIDTH,
  className,
  children,
  ...props
}: KanbanColumnProps) {
  const { draggedId, setDraggedId } = useKanbanContext("KanbanColumn");
  const [isOver, setIsOver] = useState(false);

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!draggedId) return;
      e.preventDefault();
      setIsOver(true);
    },
    onDragLeave: () => setIsOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      if (draggedId) onDrop?.(draggedId);
      setDraggedId(null);
    },
  };

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[360px] shrink-0 flex-col rounded-lg border transition-colors",
          isOver ? "border-primary bg-info-bg" : "border-border bg-surface-sunken",
          className,
        )}
        style={{ width: COLLAPSED_WIDTH, flex: `0 0 ${COLLAPSED_WIDTH}px` }}
        {...dropHandlers}
        {...props}
      >
        <button
          type="button"
          onClick={onExpand}
          aria-label={expandLabel}
          className="flex h-full w-full flex-col items-center gap-2.5 rounded-lg px-1 py-3 text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {accent}
          {meta !== undefined && <span className="rounded-full border border-border bg-surface px-1.5 text-[11px] font-semibold text-on-surface-muted">{meta}</span>}
          <span className="rotate-180 text-[13px] font-semibold [writing-mode:vertical-rl]">{title}</span>
          {subtitle !== undefined && <span className="rotate-180 text-[12px] tabular-nums text-on-surface-muted [writing-mode:vertical-rl]">{subtitle}</span>}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[360px] flex-col rounded-lg border transition-colors",
        isOver ? "border-primary bg-info-bg" : "border-border bg-surface-sunken",
        className,
      )}
      style={width ? { width, flex: `0 0 ${width}px` } : { flex: "1 1 0%", minWidth }}
      {...dropHandlers}
      {...props}
    >
      <div className="flex flex-col gap-0.5 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {accent}
          <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">{title}</h3>
          {meta !== undefined && <span className="rounded-full border border-border bg-surface px-1.5 text-[11px] font-semibold text-on-surface-muted">{meta}</span>}
          {headerAction}
        </div>
        {subtitle !== undefined && <div className="text-[12px] tabular-nums text-on-surface-muted">{subtitle}</div>}
      </div>

      {/* Radix lays the viewport out as a table, which widens it to fit long unbroken text; a block keeps cards to the column's width. */}
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3 [&_[data-radix-scroll-area-viewport]>div]:block!">
        <div className="flex flex-col gap-2">{children}</div>
      </ScrollArea>
    </div>
  );
}

export interface KanbanCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  id: string;
  children: React.ReactNode;
  /**
   * US-CRM-25 — opens the card. With it, the card is a focusable button
   * (Tab to it, Enter or Space opens it); `label` is its accessible name.
   */
  onOpen?: () => void;
  label?: string;
  /** A menu at the top right (e.g. "⋯" with Open, Move to…, Delete); it sits beside the card's own button, not inside it. Keep the first line clear of it (e.g. `pr-7` on the title), so rules and rows below can run the full width. */
  menu?: React.ReactNode;
  /** The menu key or Shift+F10 on the focused card, e.g. to open `menu`. */
  onMenuKey?: () => void;
}

/**
 * A draggable card inside a KanbanColumn. `onClick` is free for the caller
 * to use (e.g. opening an edit dialog) since drag and click are
 * distinguished natively by the browser's own drag threshold. With
 * `onOpen` the whole card is one button (an overlay under the content) and
 * `menu` is a sibling of it, so there's never a control inside a control.
 */
export function KanbanCard({ id, className, children, onDragStart, onDragEnd, onOpen, label, menu, onMenuKey, ...props }: KanbanCardProps) {
  const { draggedId, setDraggedId } = useKanbanContext("KanbanCard");

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
      data-dragging={draggedId === id || undefined}
      className={cn(
        "relative flex cursor-pointer flex-col gap-1 rounded-md border border-border-strong bg-surface p-3 text-[13px] shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing data-[dragging]:opacity-60",
        className,
      )}
      {...props}
    >
      {onOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label={label}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            } else if (onMenuKey && (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) {
              e.preventDefault();
              onMenuKey();
            }
          }}
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        />
      )}
      <div className={cn("flex min-w-0 flex-col gap-1", onOpen && "pointer-events-none relative")}>{children}</div>
      {menu && <div className="absolute right-1.5 top-1.5">{menu}</div>}
    </div>
  );
}
