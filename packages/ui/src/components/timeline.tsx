import { cn } from "../lib/cn";

export interface TimelineItemData {
  id: string;
  /** Small icon/mark rendered in the timeline's rail — typically a lucide-react icon sized ~14px. */
  icon: React.ReactNode;
  /** One-line summary, e.g. "Quote QT-2026-014 sent". */
  title: React.ReactNode;
  /** Optional supporting text below the title, e.g. a note's body. */
  description?: React.ReactNode;
  /** Right-aligned, typically a relative timestamp — caller formats it (e.g. via date-fns) since locale/format preferences vary by app. */
  timestamp?: React.ReactNode;
  /** Optional trailing content on the timestamp's row, e.g. a Badge for the event's category. */
  meta?: React.ReactNode;
  /** Tints this item's icon dot — for a status-carrying event (e.g. a rejected quote) that should stand out from routine entries. Maps to an existing semantic color token, not an arbitrary color. */
  tone?: "neutral" | "success" | "critical";
}

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItemData[];
}

const TONE_CLASSES: Record<NonNullable<TimelineItemData["tone"]>, string> = {
  neutral: "border-border-strong bg-surface text-on-surface-muted",
  success: "border-paid bg-paid-bg text-paid",
  critical: "border-overdue bg-overdue-bg text-overdue",
};

/**
 * A reverse-chronological (or any caller-sorted order — Timeline doesn't
 * sort) vertical feed of heterogeneous events: quote lifecycle events,
 * logged activities, and (once they exist) invoice/payment events, merged
 * into one list by a page like the contact detail Timeline tab. Each item
 * is caller-classified via `icon`/`tone` rather than a fixed `type` enum,
 * so this component stays domain-agnostic — it doesn't know what a "quote"
 * or "payment" is, only how to lay out an icon + title + description +
 * timestamp with a connecting rail between entries.
 */
export function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <ol className={cn("flex flex-col", className)} {...props}>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                TONE_CLASSES[item.tone ?? "neutral"],
              )}
            >
              {item.icon}
            </span>
            {index < items.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
          </div>
          <div className={cn("flex flex-1 flex-col gap-0.5", index < items.length - 1 ? "pb-5" : "pb-1")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-[13px] font-medium text-on-surface">{item.title}</span>
              <div className="flex shrink-0 items-center gap-2">
                {item.meta}
                {item.timestamp && <span className="whitespace-nowrap text-[12px] text-on-surface-muted">{item.timestamp}</span>}
              </div>
            </div>
            {item.description && <p className="text-[13px] text-on-surface-muted">{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
