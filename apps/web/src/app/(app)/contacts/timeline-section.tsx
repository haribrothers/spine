"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, Spinner, Timeline, type TimelineItemData } from "@spine/ui";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, CheckSquare, FileText, History, Phone, StickyNote, Users } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { Meeting } from "../meetings/types";
import type { Activity, ActivityType } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { t as translate, useT } from "../../../lib/i18n";

/** Mirrors apps/web/src/app/(app)/quotes/types.ts's Quote shape — a local subset, since this section only needs a handful of fields. */
interface QuoteSummary {
  id: string;
  number: string | null;
  status: "draft" | "sent" | "accepted" | "rejected";
  totalAmount: string;
  currency: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  call: <Phone size={14} />,
  meeting: <Users size={14} />,
  note: <StickyNote size={14} />,
  task: <CheckSquare size={14} />,
};


function quoteLabel(quote: QuoteSummary) {
  return quote.number ?? translate("contacts.timeline.draftQuote");
}

/**
 * S-01.3 — "see every quote, invoice, payment and note for a contact on one
 * timeline." Invoices and payments don't exist yet (Phase 2), so this
 * merges what's real today — quote lifecycle events, logged activities
 * (which already cover "note", per ActivityType), and (per S-01.9)
 * scheduled meetings — into one chronological feed via the generic
 * @spine/ui Timeline component. Structured so an invoice/payment event
 * source can be added alongside these later without reshaping this
 * component, not as a placeholder.
 *
 * Quote events are derived from each quote's own timestamp fields
 * (createdAt/sentAt/updatedAt-on-terminal-status) rather than a new
 * endpoint — quotes.ts's own `quote_events` table exists but is scoped to
 * the public accept/reject link's view/accept/reject tracking, not a
 * general lifecycle log, and there's no per-contact read endpoint for it;
 * the quote's own fields are sufficient to build "created / sent / accepted
 * / rejected" without inventing data. A meeting's timeline timestamp is its
 * `startAt` (when it happens/happened), not `createdAt` (when it was
 * scheduled) — the scheduled time is what's meaningful for "where do we
 * stand," matching how a quote's own events use their real event times.
 */
export function TimelineSection({ contactId }: { contactId: string }) {
  const t = useT();
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);

  useEffect(() => {
    // US-TEAM-31: Quotes closed for this person leaves them out.
    apiClient
      .get<QuoteSummary[]>(`/quotes?contactId=${contactId}`)
      .then(setQuotes)
      .catch(() => setQuotes([]));
    apiClient.get<Activity[]>(`/activities?contactId=${contactId}`).then(setActivities);
    // US-SET-24: no meetings while Leads & meetings is switched off.
    apiClient
      .get<Meeting[]>(`/meetings?contactId=${contactId}`)
      .then(setMeetings)
      .catch(() => setMeetings([]));
  }, [contactId]);

  const items = useMemo<TimelineItemData[] | null>(() => {
    if (quotes === null || activities === null || meetings === null) return null;

    const events: (TimelineItemData & { at: string })[] = [];

    for (const quote of quotes) {
      const total = formatMoney(quote.totalAmount, quote.currency);
      events.push({
        id: `quote-${quote.id}-created`,
        icon: <FileText size={14} />,
        title: t("contacts.timeline.quoteCreated", { label: quoteLabel(quote) }),
        description: total,
        at: quote.createdAt,
      });
      if (quote.sentAt) {
        events.push({
          id: `quote-${quote.id}-sent`,
          icon: <FileText size={14} />,
          title: t("contacts.timeline.quoteSent", { label: quoteLabel(quote) }),
          description: total,
          at: quote.sentAt,
        });
      }
      if (quote.status === "accepted") {
        events.push({
          id: `quote-${quote.id}-accepted`,
          icon: <FileText size={14} />,
          tone: "success",
          title: t("contacts.timeline.quoteAccepted", { label: quoteLabel(quote) }),
          description: total,
          at: quote.updatedAt,
        });
      } else if (quote.status === "rejected") {
        events.push({
          id: `quote-${quote.id}-rejected`,
          icon: <FileText size={14} />,
          tone: "critical",
          title: t("contacts.timeline.quoteRejected", { label: quoteLabel(quote) }),
          description: total,
          at: quote.updatedAt,
        });
      }
    }

    for (const activity of activities) {
      const done = Boolean(activity.doneAt);
      events.push({
        id: `activity-${activity.id}`,
        icon: ACTIVITY_ICONS[activity.type],
        title: (
          <span className="capitalize">
            {t(`contacts.activities.types.${activity.type}`)}
            {activity.type === "task" && done ? t("contacts.timeline.completedSuffix") : ""}
          </span>
        ),
        description: activity.notes ?? undefined,
        meta: activity.type === "task" ? <Badge>{done ? t("contacts.timeline.done") : t("contacts.timeline.open")}</Badge> : undefined,
        at: activity.createdAt,
      });
    }

    for (const meeting of meetings) {
      events.push({
        id: `meeting-${meeting.id}`,
        icon: <CalendarDays size={14} />,
        title: t("contacts.timeline.meeting", { title: meeting.title }),
        description: meeting.location ?? meeting.description ?? undefined,
        at: meeting.startAt,
      });
    }

    return events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .map(({ at, ...item }) => ({
        ...item,
        timestamp: (
          <span title={new Date(at).toLocaleString(orgLocaleTag())}>{formatDistanceToNow(new Date(at), { addSuffix: true })}</span>
        ),
      }));
  }, [quotes, activities, meetings, t]);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">{t("contacts.timeline.heading")}</h3>
      {items === null ? (
        <Spinner size="sm" />
      ) : items.length > 0 ? (
        <Timeline items={items} />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<History />}
            title={t("contacts.timeline.emptyTitle")}
            description={t("contacts.timeline.emptyDescription")}
          />
        </div>
      )}
    </section>
  );
}
