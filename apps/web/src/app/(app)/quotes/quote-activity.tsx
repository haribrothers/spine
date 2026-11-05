"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { QuoteActivityEntry } from "@spine/shared";
import { Check, Copy, Eye, GitBranch, HardHat, Link2, Mail, MailCheck, MailX, Pencil, Plus, Receipt, Send, ShieldCheck, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { orgLocaleTag } from "../../../lib/money";
import { AiFilledMark } from "../../../components/ai-filled-mark";
import { AgentMark } from "../../../components/agent-mark";
import { t, useT } from "../../../lib/i18n";

/** Consecutive views of the link become one entry: "Viewed by the customer 3 times". */
export interface ActivityItem extends QuoteActivityEntry {
  /** How many views this entry stands for. */
  views?: number;
}

export function groupActivity(entries: QuoteActivityEntry[]): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const entry of entries) {
    const last = out[out.length - 1];
    if (entry.type === "viewed" && last?.type === "viewed") last.views = (last.views ?? 1) + 1;
    else out.push(entry.type === "viewed" ? { ...entry, views: 1 } : { ...entry });
  }
  return out;
}

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-QUO-32 — what an entry says. */
export function activityText(item: ActivityItem): string {
  switch (item.type) {
    case "created":
      return t("quotes.activity.created");
    case "edited":
      return t("quotes.activity.edited");
    case "discount_approved":
      return t("quotes.activity.discountApproved");
    case "sent":
      return t("quotes.activity.sent");
    case "emailed":
      return item.detail ? t("quotes.activity.emailedTo", { detail: item.detail }) : t("quotes.activity.emailed");
    case "email_failed":
      // US-SET-28: cancelled in the email log.
      return item.detail === "Cancelled" ? t("quotes.activity.emailCancelled") : item.detail ? t("quotes.activity.emailFailedDetail", { detail: item.detail }) : t("quotes.activity.emailFailed");
    case "link_copied":
      return t("quotes.activity.linkCopied");
    case "viewed":
      return item.views && item.views > 1 ? t("quotes.activity.viewedTimes", { views: item.views }) : t("quotes.activity.viewed");
    case "revised":
      return item.detail ? t("quotes.activity.revisedFrom", { detail: item.detail }) : t("quotes.activity.revised");
    case "duplicated":
      return item.detail ? t("quotes.activity.duplicatedFrom", { detail: item.detail }) : t("quotes.activity.duplicated");
    case "accepted":
      return item.method === "in_person"
        ? t("quotes.activity.acceptedInPerson", { name: item.actorName ?? t("quotes.acceptance.teamMember") })
        : t("quotes.activity.acceptedOnline", { name: item.actorName ?? t("quotes.acceptance.theCustomer") });
    case "rejected":
      return item.method === "in_person"
        ? t("quotes.activity.declinedInPerson", { name: item.actorName ?? t("quotes.acceptance.teamMember") })
        : t("quotes.activity.declinedOnline", { name: item.actorName ?? t("quotes.acceptance.theCustomer") });
    case "converted_to_invoice":
      return item.detail ? t("quotes.activity.convertedToInvoiceDetail", { detail: item.detail }) : t("quotes.activity.convertedToInvoice");
    case "converted_to_job":
      return item.detail ? t("quotes.activity.convertedToJobDetail", { detail: item.detail }) : t("quotes.activity.convertedToJob");
  }
}

const ICONS: Record<QuoteActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: Plus,
  edited: Pencil,
  discount_approved: ShieldCheck,
  sent: Send,
  emailed: MailCheck,
  email_failed: MailX,
  link_copied: Link2,
  viewed: Eye,
  revised: GitBranch,
  duplicated: Copy,
  accepted: Check,
  rejected: X,
  converted_to_invoice: Receipt,
  converted_to_job: HardHat,
};

function linkFor(item: ActivityItem): string | null {
  if (!item.linkId) return null;
  if (item.type === "revised") return `/quotes/${item.linkId}`;
  if (item.type === "converted_to_invoice") return `/invoices/${item.linkId}`;
  if (item.type === "converted_to_job") return `/jobs/${item.linkId}`;
  return null;
}

const CUSTOMER = new Set<QuoteActivityEntry["type"]>(["viewed", "accepted", "rejected"]);
const SHOWN = 6;

/**
 * US-QUO-32 (D-214) — the quote's story, newest first: what we did, what
 * the customer did (views grouped, the comment on an answer), the email,
 * and what it became. "View history" keeps the field-level changes.
 */
export function QuoteActivity({ quoteId, status, refreshKey, onViewHistory }: { quoteId: string; status: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const t = useT();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<QuoteActivityEntry[]>(`/quotes/${quoteId}/activity`)
      .then((rows) => setItems(groupActivity(rows)))
      .catch(() => setItems([]));
  }, [quoteId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;
  const viewed = items?.some((i) => i.type === "viewed");

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="quote-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">{t("quotes.activity.title")}</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          {t("quotes.activity.viewHistory")}
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.map((item, i) => {
          const Icon = ICONS[item.type];
          const href = linkFor(item);
          const customer = CUSTOMER.has(item.type);
          const won = item.type === "accepted";
          const sub = item.type === "viewed" ? t("quotes.activity.lastViewed", { when: when(item.at) }) : [!customer && item.actorName ? item.actorName : null, when(item.at)].filter(Boolean).join(" · ");
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  won ? "border-transparent bg-paid-bg text-paid" : customer ? "border-transparent bg-info-bg text-primary" : item.type === "email_failed" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
                )}
                aria-hidden
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-on-surface">
                  {href ? (
                    <Link href={href} className="font-semibold hover:text-primary hover:underline">
                      {activityText(item)}
                    </Link>
                  ) : (
                    <span className="font-semibold">{activityText(item)}</span>
                  )}
                  {item.aiAssisted && <AiFilledMark />}
                  {item.via && <AgentMark agent={item.via} person={item.actorName} />}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{sub}</p>
                {(item.type === "accepted" || item.type === "rejected") && item.detail && (
                  <p className="mt-1.5 rounded-md bg-surface-sunken px-2.5 py-1.5 text-[12.5px] leading-snug text-on-surface">{t("quotes.acceptance.quotedComment", { comment: item.detail })}</p>
                )}
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              {t("quotes.activity.showEarlier", { earlier: items.length - SHOWN })}
            </button>
          </li>
        )}
        {items && status === "sent" && !viewed && (
          <li className="mt-1 flex items-center gap-2 text-[12.5px] italic text-on-surface-muted" data-testid="quote-not-viewed">
            <Mail size={13} aria-hidden /> {t("quotes.activity.notViewed")}
          </li>
        )}
      </ol>
    </Card>
  );
}
