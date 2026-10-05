/**
 * US-DASH-12 (D-087, D-088) — "Needs your attention": one row per kind of
 * open item, in a fixed order, each with its count and the first records.
 * The server decides which kinds a member gets (capabilities, ownership);
 * this file decides how a row reads.
 */

export const ATTENTION_KINDS = [
  "invoices_overdue",
  "expenses_awaiting_approval",
  "quotes_discount_approval",
  "milestones_to_invoice",
  "quotes_expiring",
  "vendor_bills_due",
  "jobs_over_budget",
  // US-DASH-17 — Staff: their own overdue follow-ups.
  "followups_overdue",
  // US-DASH-18 — Field: milestones due on their jobs, their rejected expenses.
  "milestones_due",
  "expenses_rejected",
] as const;

export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/** One record behind a row. Which fields are set depends on the kind. */
export interface AttentionRecord {
  id: string;
  /** INV-0002, QUO-0004, BILL-2231, JOB-002 */
  number?: string | null;
  /** The main name: a contact, milestone, follow-up or job. */
  name?: string | null;
  /** A second name: the job a milestone belongs to, an expense's submitter or category, a bill's vendor. */
  party?: string | null;
  /** Minor units as a string. */
  amount?: string | null;
  /** `YYYY-MM-DD`: due date, expiry, completion or submission day. */
  date?: string | null;
  /** Free detail: discount %, completed by, reviewer's comment. */
  note?: string | null;
  /** For links: the job a milestone or claim belongs to. */
  jobId?: string | null;
  /** Jobs over budget: the budget, minor units. */
  budget?: string | null;
  /** Vendor bills: the vendor, for "Pay bill". */
  contactId?: string | null;
}

export interface AttentionItem {
  kind: AttentionKind;
  count: number;
  currency: string;
  /** The first few records, most urgent first; `items[0]` is the one named. */
  items: AttentionRecord[];
  /** US-NTF-13: the sum of every record's amount (not just the sample), for money kinds — overdue invoices, expenses to approve, bills due. Minor units. */
  total?: string;
  /** US-DASH-17: the records are the member's own (a Staff user's quotes), so the row says "Your quote …". */
  mine?: boolean;
}

export interface AttentionText {
  title: string;
  detail: string;
  /** The button's label (US-DASH-13 wires what it does). */
  action: string;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function daysBetween(from: string, to: string): number {
  const ms = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

/** "Fri 9 Oct" */
function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Friday", or "today" / "tomorrow" */
function dayName(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

function join(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(" · ");
}

/**
 * The words for one row: "1 invoice is overdue" / "INV-0002 · Maple Ridge
 * Developments · $4,542.50 · 12 days late" / "Send reminder". `money`
 * formats minor units in the item's currency; `today` is `YYYY-MM-DD`.
 */
export function describeAttention(item: AttentionItem, money: (minor: string) => string, today: string): AttentionText {
  const first = item.items[0] ?? { id: "" };
  const n = item.count;
  const amount = first.amount ? money(first.amount) : null;
  const more = n > 1 ? `and ${n - 1} more` : null;

  switch (item.kind) {
    case "invoices_overdue": {
      const late = first.date ? daysBetween(first.date, today) : null;
      return {
        title: `${n} ${plural(n, "invoice is", "invoices are")} overdue`,
        detail: join([first.number, first.name, amount, late !== null && `${late} ${plural(late, "day", "days")} late`, more]),
        action: "Send reminder",
      };
    }
    case "expenses_awaiting_approval":
      return {
        title: `${n} ${plural(n, "expense", "expenses")} waiting for your approval`,
        detail: join([first.name, ...item.items.slice(0, 2).map((e) => `${e.party ?? "Expense"} ${e.amount ? money(e.amount) : ""}`.trim()), n > 2 ? `and ${n - 2} more` : null]),
        action: "Review",
      };
    case "quotes_discount_approval":
      return {
        title: n === 1 ? `${first.number ?? "A draft quote"} needs discount approval` : `${n} quotes need discount approval`,
        detail: join([first.name, first.note, amount, more]),
        action: "Approve",
      };
    case "milestones_to_invoice":
      return {
        title: n === 1 ? "Milestone ready to invoice" : `${n} milestones ready to invoice`,
        detail: join([first.name, first.party, first.note && `completed by ${first.note}`, more]),
        action: "Raise invoice",
      };
    case "quotes_expiring":
      return {
        title:
          n === 1
            ? `${item.mine ? "Your quote " : ""}${first.number ?? (item.mine ? "" : "A quote")}`.trim() + ` expires ${first.date ? dayName(first.date, today) : "soon"}`
            : `${item.mine ? "Your " : ""}${n} quotes expire this week`,
        detail: join([n > 1 ? first.number : null, first.name, amount, first.date && shortDay(first.date), more]),
        action: "Follow up",
      };
    case "vendor_bills_due": {
      const days = first.date ? daysBetween(today, first.date) : null;
      return {
        title: n === 1 ? (days === 0 ? "Vendor bill due today" : `Vendor bill due in ${days} ${plural(days ?? 0, "day", "days")}`) : `${n} vendor bills due in the next 3 days`,
        detail: join([first.name, first.number, amount, first.date && `due ${shortDay(first.date)}`, more]),
        action: "Pay bill",
      };
    }
    case "jobs_over_budget": {
      const over = first.amount && first.budget ? money((BigInt(first.amount) - BigInt(first.budget)).toString()) : null;
      return {
        title: `${n} ${plural(n, "job is", "jobs are")} over budget`,
        detail: join([first.number, first.name, over && first.budget && `${over} over a ${money(first.budget)} budget`, more]),
        action: "Review",
      };
    }
    case "followups_overdue":
      return {
        title: `${n} ${plural(n, "follow-up is", "follow-ups are")} overdue`,
        detail: join(item.items.slice(0, 2).map((f) => f.name).concat(n > 2 ? [`and ${n - 2} more`] : [])),
        action: "Open",
      };
    case "milestones_due":
      return {
        title: n === 1 ? `Milestone due ${first.date ? dayName(first.date, today) : "soon"}` : `${n} milestones due this week`,
        detail: join([first.name, first.party, more]),
        action: "Mark complete",
      };
    case "expenses_rejected":
      return {
        title: n === 1 ? "Your expense was rejected" : `${n} of your expenses were rejected`,
        detail: join([first.party, amount, first.note && `“${first.note}”${first.name ? ` — ${first.name}` : ""}`, more]),
        action: "Fix and resubmit",
      };
  }
}

/** The header's "<n> things need you today", or "nothing needs you right now". */
export function attentionSummary(rows: number): string {
  return rows === 0 ? "nothing needs you right now" : `${rows} ${rows === 1 ? "thing needs" : "things need"} you today`;
}

/** US-DASH-18 — a Field user's header: "2 jobs on your list · 2 things need you". */
export function fieldSummary(jobs: number, rows: number): string {
  return `${jobs} ${jobs === 1 ? "job" : "jobs"} on your list · ${rows === 0 ? "nothing needs you right now" : `${rows} ${rows === 1 ? "thing needs" : "things need"} you`}`;
}

/** "Good morning|afternoon|evening" for an hour 0–23. */
export function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
