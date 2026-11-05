"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { VendorPaymentActivityEntry } from "@spine/shared";
import { ArrowRightLeft, HandCoins, MailCheck } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { t, useT } from "../../../lib/i18n";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./types";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PUR-49 — what an entry says; `link` is the bill it names. */
export function vendorPaymentActivityText(item: VendorPaymentActivityEntry, currency: string): { text: string; link?: { label: string; href: string } } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  switch (item.type) {
    case "recorded": {
      const method = item.method ? (PAYMENT_METHOD_LABELS[item.method as PaymentMethod] ?? item.method).toLowerCase() : null;
      return {
        text: [
          t("vendorPayments.activity.recorded"),
          [money(item.amount), method ? t("vendorPayments.activity.byMethod", { method }) : null, item.account ? t("vendorPayments.activity.fromAccount", { account: item.account }) : null].filter(Boolean).join(" "),
        ].join(" · "),
      };
    }
    case "applied":
      return { text: t("vendorPayments.activity.paidOn", { amount: money(item.amount) }), link: item.linkId ? { label: item.detail ?? t("vendorPayments.activity.aBill"), href: `/vendor-bills/${item.linkId}` } : undefined };
    case "remittance_emailed":
      return { text: item.detail ? t("vendorPayments.activity.remittanceEmailedTo", { to: item.detail }) : t("vendorPayments.activity.remittanceEmailed") };
  }
}

const ICONS: Record<VendorPaymentActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  recorded: HandCoins,
  applied: ArrowRightLeft,
  remittance_emailed: MailCheck,
};

/** US-PUR-49 (D-229) — the payment's story, newest first: recorded, each bill it paid, remittance advice emailed. */
export function VendorPaymentActivity({ paymentId, currency, refreshKey, onViewHistory }: { paymentId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const t = useT();
  const [items, setItems] = useState<VendorPaymentActivityEntry[] | null>(null);

  useEffect(() => {
    apiClient
      .get<VendorPaymentActivityEntry[]>(`/vendor-payments/${paymentId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [paymentId, refreshKey]);

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="vendor-payment-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">{t("vendorPayments.activity.title")}</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          {t("vendorPayments.activity.viewHistory")}
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!items && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {items?.map((item, i) => {
          const Icon = ICONS[item.type];
          const { text, link } = vendorPaymentActivityText(item, currency);
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="vendor-payment-activity-entry">
              {i < items.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full border", item.type === "applied" ? "border-transparent bg-paid-bg text-paid" : "border-border bg-surface-sunken text-on-surface-muted")}
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
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
