"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { PaymentActivityEntry } from "@spine/shared";
import { ArrowRightLeft, Banknote, MailCheck, Undo2, Wallet } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./types";
import { t, useT } from "../../../lib/i18n";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PAY-20 — what an entry says; `link` is the invoice it names, shown as a link. */
export function paymentActivityText(item: PaymentActivityEntry, currency: string): { text: string; link?: string; after?: string } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  const method = item.detail ? (PAYMENT_METHOD_LABELS[item.detail as PaymentMethod] ?? item.detail) : null;
  switch (item.type) {
    case "recorded":
      return { text: [t("payments.activity.recorded"), [money(item.amount), method ? t("payments.activity.byMethod", { method: method.toLowerCase() }) : null, item.account ? t("payments.activity.intoAccount", { account: item.account }) : null].filter(Boolean).join(" ")].filter(Boolean).join(" · ") };
    case "applied":
      return { text: t("payments.activity.appliedTo", { amount: money(item.amount) }), link: item.detail ?? undefined };
    case "unapplied":
      return { text: t("payments.activity.movedOff", { amount: money(item.amount) }), link: item.detail ?? undefined, after: item.reason ?? undefined };
    case "emailed":
      return { text: item.detail ? t("payments.activity.receiptEmailedTo", { to: item.detail }) : t("payments.activity.receiptEmailed") };
    case "refunded":
      return { text: [t("payments.activity.refunded"), money(item.amount), method].filter(Boolean).join(" · ") };
    case "refund_deleted":
      return { text: [t("payments.activity.refundDeleted"), money(item.amount)].filter(Boolean).join(" · ") };
  }
}

const ICONS: Record<PaymentActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  recorded: Wallet,
  applied: ArrowRightLeft,
  unapplied: Undo2,
  emailed: MailCheck,
  refunded: Banknote,
  refund_deleted: Undo2,
};

const SHOWN = 6;

/**
 * US-PAY-20 (D-221) — a payment's story, newest first: recorded (how much,
 * how, into which account), applied to each invoice, moved off one, the
 * receipt emailed, refunds and refunds deleted, with who and when. "View
 * history" keeps the field-level changes.
 */
export function PaymentActivity({ paymentId, currency, refreshKey, onViewHistory }: { paymentId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const t = useT();
  const [items, setItems] = useState<PaymentActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<PaymentActivityEntry[]>(`/payments/${paymentId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [paymentId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="payment-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">{t("payments.activity.title")}</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          {t("payments.activity.viewHistory")}
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">{t("payments.activity.empty")}</li>}
        {shown?.map((item, i) => {
          const Icon = ICONS[item.type];
          const { text, link, after } = paymentActivityText(item, currency);
          const href = link && item.linkId && (item.type === "applied" || item.type === "unapplied") ? `/invoices/${item.linkId}` : null;
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="payment-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "applied" ? "border-transparent bg-paid-bg text-paid" : item.type === "unapplied" || item.type === "refund_deleted" ? "border-transparent bg-due-soon-bg text-due-soon" : "border-border bg-surface-sunken text-on-surface-muted",
                )}
                aria-hidden
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-on-surface">
                  <span className="font-semibold">{text}</span>
                  {link && (
                    <>
                      {" "}
                      {href ? (
                        <Link href={href} className="font-medium text-primary hover:underline">
                          {link}
                        </Link>
                      ) : (
                        <span className="font-medium">{link}</span>
                      )}
                    </>
                  )}
                  {after && t("payments.activity.quotedReason", { reason: after })}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              {t("payments.activity.showEarlier", { n: items.length - SHOWN })}
            </button>
          </li>
        )}
      </ol>
    </Card>
  );
}
