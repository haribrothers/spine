"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Spinner, cn } from "@spine/ui";
import { describeAttention, type AttentionItem, type AttentionKind } from "@spine/shared";
import { ArrowUpRight, Check, CircleAlert, Clock, DollarSign, MailX, OctagonAlert, Percent } from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { WidgetSkeleton } from "./dashboard-skeleton";
import { useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";

/** US-DASH-31: on a phone the first three show, then "Show all <n>". */
const PHONE_SHOWN = 3;

const KIND_STYLE: Record<AttentionKind, { icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; tone: string }> = {
  invoices_overdue: { icon: CircleAlert, tone: "bg-overdue-bg text-overdue" },
  expenses_awaiting_approval: { icon: DollarSign, tone: "bg-due-soon-bg text-due-soon" },
  quotes_discount_approval: { icon: Percent, tone: "bg-info-bg text-primary" },
  milestones_to_invoice: { icon: Check, tone: "bg-paid-bg text-paid" },
  quotes_expiring: { icon: Clock, tone: "bg-info-bg text-primary" },
  vendor_bills_due: { icon: ArrowUpRight, tone: "bg-surface-sunken text-on-surface-muted" },
  jobs_over_budget: { icon: OctagonAlert, tone: "bg-overdue-bg text-overdue" },
  followups_overdue: { icon: CircleAlert, tone: "bg-overdue-bg text-overdue" },
  milestones_due: { icon: Clock, tone: "bg-due-soon-bg text-due-soon" },
  expenses_rejected: { icon: CircleAlert, tone: "bg-overdue-bg text-overdue" },
  emails_failed: { icon: MailX, tone: "bg-overdue-bg text-overdue" },
};

/** Where a row's button goes (US-DASH-13 turns some into one-click actions). */
export function attentionHref(item: AttentionItem): string {
  const first = item.items[0];
  const one = item.count === 1 && first;
  switch (item.kind) {
    case "invoices_overdue":
      return one ? `/invoices/${first.id}` : "/invoices?status=overdue&select=overdue";
    case "expenses_awaiting_approval":
      return "/expenses?card=wait";
    case "quotes_discount_approval":
    case "quotes_expiring":
      return one ? `/quotes/${first.id}` : "/quotes";
    case "milestones_to_invoice":
    case "milestones_due":
      return first?.jobId ? `/jobs/${first.jobId}` : "/jobs";
    case "vendor_bills_due":
      // US-DASH-13: straight to the payment dialog for the first bill's vendor.
      return first?.contactId ? `/vendor-payments?contactId=${first.contactId}&pay=1` : "/vendor-bills";
    case "jobs_over_budget":
      return first?.jobId ? `/jobs/${first.jobId}?tab=costing` : "/jobs";
    case "followups_overdue":
      // The oldest one's contact, where its Activities live; a lead without a contact opens the pipeline.
      return first?.contactId ? `/contacts/${first.contactId}` : "/leads";
    case "expenses_rejected":
      return one ? `/expenses/${first.id}` : "/expenses?by=me&state=rej";
    case "emails_failed":
      // US-DASH-30: the email log, filtered to the failed ones.
      return "/emails?card=failed";
  }
}

export interface AttentionRowAction {
  label: string;
  onClick?: () => void;
  href?: string;
  busy?: boolean;
}

/**
 * US-DASH-12 (D-087, D-088) — "Needs your attention": one row per kind of
 * open item with its count, the first record named, and an action. The
 * chip beside the heading is the number of rows. Rows are rebuilt on every
 * visit, so resolved items disappear on their own.
 */
export function AttentionCard({
  items,
  note,
  today,
  actionFor,
  emptyText,
  className,
}: {
  /** Null while loading. */
  items: AttentionItem[] | null;
  /** "Cleared items disappear automatically" (Owners) or "Only things you can act on". */
  note: string;
  today: string;
  /** The button for a row; defaults to a link. */
  actionFor?: (item: AttentionItem, label: string) => AttentionRowAction;
  /** The caught-up line; Field's never mentions money (US-DASH-18). */
  emptyText?: string;
  className?: string;
}) {
  const t = useT();
  const phone = useIsPhone();
  const [all, setAll] = useState(false);
  if (items !== null && items.length === 0) {
    return (
      <Card className={cn("flex flex-col items-center justify-center gap-2 py-8 text-center", className)} data-testid="attention-card">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paid-bg text-paid">
          <Check size={20} aria-hidden />
        </span>
        <h2 className="text-[16px] font-semibold text-on-surface">{t("dashboard.attention.caughtUp")}</h2>
        <p className="max-w-sm text-[13px] text-on-surface-muted">{emptyText ?? t("dashboard.attention.emptyText")}</p>
      </Card>
    );
  }

  return (
    <Card className={cn("@container flex flex-col gap-2", className)} data-testid="attention-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-on-surface">
          {t("dashboard.attention.title")}
          {items && (
            <span className="rounded-full bg-overdue-bg px-2 py-0.5 text-[12px] font-semibold text-overdue" aria-label={t("dashboard.attention.itemsAria", { n: items.length })}>
              {items.length}
            </span>
          )}
        </h2>
        <span className="text-[12px] text-on-surface-muted max-md:hidden">{note}</span>
      </div>
      {!items ? (
        <div className="pt-2">
          <WidgetSkeleton kind="rows" rows={3} />
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {(phone && !all ? items.slice(0, PHONE_SHOWN) : items).map((item) => {
            const text = describeAttention(item, (minor) => formatMoney(BigInt(minor), item.currency), today);
            const { icon: Icon, tone } = KIND_STYLE[item.kind];
            const action = actionFor ? actionFor(item, text.action) : { label: text.action, href: attentionHref(item) };
            return (
              <li key={item.kind} className="flex items-start gap-3 py-3 @[28rem]:items-center max-md:items-center" data-kind={item.kind}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone)}>
                  <Icon size={16} aria-hidden />
                </span>
                {/* US-DASH-29: in the narrow side column the button goes under the text. */}
                {/* US-DASH-31: on a phone the button is on the right, the text in two lines beside it. */}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2 @[28rem]:flex-row @[28rem]:items-center @[28rem]:gap-3 max-md:flex-row max-md:items-center max-md:gap-3">
                  <div className="flex w-full min-w-0 flex-1 flex-col">
                    <span className="text-[14px] font-semibold text-on-surface max-md:line-clamp-2">{text.title}</span>
                    <span className="truncate text-[13px] text-on-surface-muted" title={text.detail}>{text.detail}</span>
                  </div>
                  {action.href ? (
                    <Button asChild variant="secondary" size="sm" className="shrink-0">
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={action.onClick} disabled={action.busy}>
                      {action.busy ? <Spinner size="sm" /> : action.label}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {phone && items && items.length > PHONE_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="-mx-5 -mb-5 flex h-12 items-center justify-center border-t border-border text-[15px] font-semibold text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          {all ? t("dashboard.attention.showFewer") : t("dashboard.attention.showAll", { n: items.length })}
        </button>
      )}
    </Card>
  );
}
