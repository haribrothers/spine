"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { VendorBillActivityEntry } from "@spine/shared";
import { Ban, Banknote, FileCheck, FilePlus, ArrowRightLeft, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { t, useT } from "../../../lib/i18n";
import { AiFilledMark } from "../../../components/ai-filled-mark";
import { AgentMark } from "../../../components/agent-mark";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PUR-32 — what an entry says; `link` is the payment or credit it names. */
export function billActivityText(item: VendorBillActivityEntry, currency: string): { text: string; link?: { label: string; href: string }; after?: string } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  switch (item.type) {
    case "created":
      return { text: t("vendorBills.activity.created") };
    case "recorded":
      return { text: t("vendorBills.activity.recorded", { amount: money(item.amount) }) };
    case "paid":
      // US-PUR-49: the payment's own page; a deleted one is named without a link.
      return item.linkId
        ? { text: t("vendorBills.activity.paidBy", { amount: money(item.amount) }), link: { label: item.detail ?? t("vendorBills.activity.aPayment"), href: `/vendor-payments/${item.linkId}` } }
        : { text: t("vendorBills.activity.paidByNamed", { amount: money(item.amount), payment: item.detail ?? t("vendorBills.activity.aPayment") }) };
    case "credit_applied":
      return { text: t("vendorBills.activity.creditAppliedFrom", { amount: money(item.amount) }), link: item.linkId ? { label: item.detail ?? t("vendorBills.activity.aCredit"), href: `/vendor-credits/${item.linkId}` } : undefined };
    case "voided":
      return { text: t("vendorBills.activity.voided"), after: item.detail ?? undefined };
    case "payment_deleted":
      return { text: t("vendorBills.activity.paymentDeleted", { payment: item.detail ?? "", amount: money(item.amount) }).replace("  ", " ") };
  }
}

const ICONS: Record<VendorBillActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: FilePlus,
  recorded: FileCheck,
  paid: Banknote,
  credit_applied: ArrowRightLeft,
  voided: Ban,
  payment_deleted: Trash2,
};

const SHOWN = 6;

/**
 * US-PUR-32 (D-225) — a bill's story, newest first: created, recorded, each
 * payment and vendor credit put against it, voided (with why), with who and
 * when. "View history" keeps the field-level changes.
 */
export function VendorBillActivity({ billId, currency, refreshKey, onViewHistory }: { billId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const t = useT();
  const [items, setItems] = useState<VendorBillActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<VendorBillActivityEntry[]>(`/vendor-bills/${billId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [billId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="bill-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">{t("vendorBills.activity.title")}</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          {t("vendorBills.activity.viewHistory")}
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">{t("vendorBills.activity.nothingYet")}</li>}
        {shown?.map((item, i) => {
          const Icon = ICONS[item.type];
          const { text, link, after } = billActivityText(item, currency);
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="bill-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "paid" || item.type === "credit_applied" ? "border-transparent bg-paid-bg text-paid" : item.type === "voided" || item.type === "payment_deleted" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
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
                      <Link href={link.href} className="font-medium text-primary hover:underline">
                        {link.label}
                      </Link>
                    </>
                  )}
                  {after && <>{t("vendorBills.activity.afterQuote", { text: after })}</>}
                  {item.aiAssisted && <AiFilledMark />}
                  {item.via && <AgentMark agent={item.via} person={item.actorName} />}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              {t("vendorBills.activity.showEarlier", { count: items.length - SHOWN })}
            </button>
          </li>
        )}
      </ol>
    </Card>
  );
}
