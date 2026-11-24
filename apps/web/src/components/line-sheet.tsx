"use client";

import { BottomSheet, Button, cn } from "@spine/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useT } from "../lib/i18n";

/** What a line card shows: the item and its amount, its description, "4 × $650.00", its tax. */
export interface PhoneLineCardData {
  key: string;
  type: "item" | "heading" | "text";
  name: string;
  description?: string;
  /** The line amount, formatted. */
  amount?: string;
  /** "4 × $650.00 · 10% off". */
  detail?: string;
  /** "Tax 18%", "GST 18%". */
  tax?: string;
  /** A note under the card (a tax warning, "Suggested by AI"). */
  note?: React.ReactNode;
}

/**
 * US-OPS-59 (D-283) — a builder's lines on a phone: one card per line (item and amount,
 * description, "4 × $650.00", tax), headings and text between them, then Add item (and the
 * builder's other adds). Tapping a card opens it in the `LineSheet`.
 */
export function PhoneLineCards({
  lines,
  onOpen,
  onAdd,
  addLabel,
  extraAdds,
  testId,
}: {
  lines: PhoneLineCardData[];
  onOpen: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  /** More ways to add (Add heading, Add text, Draft lines with AI), small, under Add item. */
  extraAdds?: React.ReactNode;
  testId?: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      <ul className="flex flex-col gap-2" data-testid={testId}>
        {lines.map((line, index) => (
          <li key={line.key}>
            <button
              type="button"
              onClick={() => onOpen(index)}
              aria-label={t("common.lineSheet.openLine", { index: index + 1, total: lines.length, name: line.name || t("common.lineSheet.untitled") })}
              data-line-card=""
              className={cn(
                "w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                line.type === "item" ? "border border-border bg-surface px-3.5 py-3" : "px-1 py-1.5",
              )}
            >
              {line.type === "item" ? (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className={cn("min-w-0 text-[15px] font-semibold leading-snug", line.name ? "text-on-surface" : "italic text-on-surface-muted")}>{line.name || t("common.lineSheet.untitled")}</span>
                    {line.amount && <span className="shrink-0 text-[15px] font-semibold tabular-nums text-on-surface">{line.amount}</span>}
                  </span>
                  {line.description && <span className="mt-0.5 block text-[13px] text-on-surface-muted">{line.description}</span>}
                  {(line.detail || line.tax) && (
                    <span className="mt-1.5 flex items-center justify-between gap-3 text-[13px] tabular-nums text-on-surface-muted">
                      <span>{line.detail}</span>
                      {line.tax && <span>{line.tax}</span>}
                    </span>
                  )}
                </>
              ) : (
                <span className={cn("block text-[13px] text-on-surface-muted", line.type === "heading" && "font-semibold text-on-surface")}>{line.name || t("common.lineSheet.untitled")}</span>
              )}
            </button>
            {line.note}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="flex h-12 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-[15px] font-semibold text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus size={18} aria-hidden />
        {addLabel}
      </button>
      {extraAdds ? <div className="flex flex-wrap gap-2">{extraAdds}</div> : null}
    </div>
  );
}

/**
 * US-OPS-59 (D-283) — one line, edited in a sheet on a phone: Cancel, "Line 1 of 3" and Done
 * at the top (changes are kept only with Done), the builder's fields in one column, what the
 * line comes to, and Move up, Move down and Delete for a line that's already there.
 */
export function LineSheet({
  open,
  title,
  onCancel,
  onDone,
  summary,
  onMoveUp,
  onMoveDown,
  onDelete,
  children,
}: {
  open: boolean;
  /** "Line 1 of 3", or "New line". */
  title: string;
  onCancel: () => void;
  onDone: () => void;
  /** What the line comes to: "120 × $4,500.00", tax, Line amount. */
  summary?: React.ReactNode;
  /** Undefined hides the button (a new line); null shows it disabled (the first line). */
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const editing = onDelete !== undefined;
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={title}
      height="full"
      data-testid="line-sheet"
      headerLeading={
        <Button type="button" variant="ghost" onClick={onCancel} className="text-[16px] font-normal">
          {t("common.lineSheet.cancel")}
        </Button>
      }
      headerAction={
        <Button type="button" variant="ghost" onClick={onDone} className="text-[16px] font-semibold text-primary">
          {t("common.lineSheet.done")}
        </Button>
      }
      footer={
        editing ? (
          <>
            <Button type="button" variant="secondary" className="flex-1" disabled={!onMoveUp} onClick={onMoveUp ?? undefined}>
              <ArrowUp size={16} aria-hidden />
              {t("common.lineSheet.moveUp")}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" disabled={!onMoveDown} onClick={onMoveDown ?? undefined}>
              <ArrowDown size={16} aria-hidden />
              {t("common.lineSheet.moveDown")}
            </Button>
            <Button type="button" variant="secondary" className="flex-1 text-overdue" onClick={onDelete}>
              <Trash2 size={16} aria-hidden />
              {t("common.lineSheet.delete")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {children}
        {summary ? <div className="rounded-lg bg-surface-sunken px-4 py-3 text-[13.5px]">{summary}</div> : null}
      </div>
    </BottomSheet>
  );
}

/** One row of a line sheet's summary: "GST 18%  $97,200.00"; `total` is the bold last one. */
export function LineSheetSummaryRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 tabular-nums", total ? "mt-1 border-t border-border pt-2 text-[15px] font-semibold text-on-surface" : "text-on-surface-muted")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** A labelled field in a line sheet, one per row. */
export function LineSheetField({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-on-surface">
        {label}
      </label>
      {children}
    </div>
  );
}
