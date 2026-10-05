/**
 * US-DASH-19 — one row of the dashboard's activity feed. It starts with
 * who did it (a member, or the customer for a customer's own action),
 * then what happened; amounts are `strong` parts, already formatted.
 * Repeated views of one quote within 24 hours come as one row with
 * `groupCount`.
 */
export interface ActivityFeedActor {
  name: string;
  kind: "member" | "customer";
}

export interface ActivityFeedPart {
  text: string;
  strong?: boolean;
}

export interface ActivityFeedEntry {
  type: string;
  actor: ActivityFeedActor | null;
  /** What happened, after the actor's name. */
  parts: ActivityFeedPart[];
  /** The whole sentence as plain text, e.g. for screen readers. */
  message: string;
  /** More than one event folded into this row ("· 3 times"). */
  groupCount?: number;
  link: string | null;
  occurredAt: string;
}

/** "Alex Morgan recorded a payment of $5,000.00 from Maple Ridge Developments · 3 times" */
export function activityMessage(actor: ActivityFeedActor | null, parts: ActivityFeedPart[], groupCount?: number): string {
  const text = [actor?.name, parts.map((p) => p.text).join("")].filter(Boolean).join(" ");
  return groupCount && groupCount > 1 ? `${text} · ${groupCount} times` : text;
}

/** "AM" for "Alex Morgan", "HC" for "Harborview Construction Co.". */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Within this window, repeated views of one quote are one row. */
export const QUOTE_VIEW_GROUP_MS = 24 * 60 * 60 * 1000;

/**
 * Folds views of the same quote within 24 hours of the latest into one row
 * carrying the latest time and the count. Expects newest first.
 */
export function groupQuoteViews<T extends { quoteId: string; at: Date }>(views: T[]): (T & { count: number })[] {
  const rows: (T & { count: number })[] = [];
  const open = new Map<string, T & { count: number }>();
  for (const view of views) {
    const current = open.get(view.quoteId);
    if (current && current.at.getTime() - view.at.getTime() <= QUOTE_VIEW_GROUP_MS) {
      current.count += 1;
      continue;
    }
    const row = { ...view, count: 1 };
    open.set(view.quoteId, row);
    rows.push(row);
  }
  return rows;
}
