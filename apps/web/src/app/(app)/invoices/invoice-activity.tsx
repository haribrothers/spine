"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { InvoiceActivityEntry } from "@spine/shared";
import { Ban, Banknote, Bell, BellRing, Copy, FileMinus, HardHat, MailCheck, MailX, Pencil, Plus, Receipt, Send, Wallet } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./types";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-INV-32 — what an entry says, without its link (the link is the part after the dot). */
export function invoiceActivityText(item: InvoiceActivityEntry, currency: string): { text: string; link?: string } {
  const money = item.amount ? formatMoney(BigInt(item.amount), currency) : null;
  switch (item.type) {
    case "created":
      return { text: "Created" };
    case "created_from_quote":
      return { text: "Created from quote", link: item.detail ?? undefined };
    case "created_from_milestone":
      return { text: "Created from milestone", link: item.detail ?? undefined };
    case "duplicated":
      return { text: "Duplicated from", link: item.detail ?? undefined };
    case "edited":
      return { text: "Edited" };
    case "issued":
      return { text: "Issued" };
    case "emailed":
      return { text: item.detail ? `Emailed to ${item.detail}` : "Emailed" };
    case "email_failed":
      return { text: item.detail ? `Email failed: ${item.detail}` : "Email failed" };
    case "reminder_sent":
      return { text: "Reminder sent" };
    case "auto_reminder_sent":
      return { text: "Automatic reminder sent" };
    case "payment_recorded": {
      const method = item.method ? PAYMENT_METHOD_LABELS[item.method as PaymentMethod] : null;
      return { text: ["Payment recorded", money, method].filter(Boolean).join(" · "), link: item.detail ?? undefined };
    }
    case "credit_applied":
      return { text: ["Credit applied", money].filter(Boolean).join(" · "), link: item.detail ?? undefined };
    case "credit_note_issued":
      return { text: "Credit note issued", link: item.detail ?? undefined };
    case "voided":
      return { text: item.detail ? `Voided: ${item.detail}` : "Voided" };
  }
}

const ICONS: Record<InvoiceActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: Plus,
  created_from_quote: Receipt,
  created_from_milestone: HardHat,
  duplicated: Copy,
  edited: Pencil,
  issued: Send,
  emailed: MailCheck,
  email_failed: MailX,
  reminder_sent: Bell,
  auto_reminder_sent: BellRing,
  payment_recorded: Banknote,
  credit_applied: Wallet,
  credit_note_issued: FileMinus,
  voided: Ban,
};

function hrefFor(item: InvoiceActivityEntry): string | null {
  if (!item.linkId) return null;
  if (item.type === "created_from_quote") return `/quotes/${item.linkId}`;
  if (item.type === "created_from_milestone") return `/jobs/${item.linkId}`;
  if (item.type === "duplicated") return `/invoices/${item.linkId}`;
  if (item.type === "payment_recorded") return `/payments?id=${item.linkId}`;
  return null;
}

const TONE: Partial<Record<InvoiceActivityEntry["type"], string>> = {
  payment_recorded: "border-transparent bg-paid-bg text-paid",
  credit_applied: "border-transparent bg-paid-bg text-paid",
  auto_reminder_sent: "border-transparent bg-overdue-bg text-overdue",
  email_failed: "border-transparent bg-overdue-bg text-overdue",
  voided: "border-transparent bg-overdue-bg text-overdue",
};

const SHOWN = 6;

/**
 * US-INV-32 (D-217) — the invoice's story, newest first: how it was made,
 * issued, emailed, chased, paid, credited or voided, with who and when.
 * "View history" keeps the field-level changes.
 */
export function InvoiceActivity({ invoiceId, currency, refreshKey, onViewHistory }: { invoiceId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<InvoiceActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<InvoiceActivityEntry[]>(`/invoices/${invoiceId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [invoiceId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="invoice-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">Activity</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          View history
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">Nothing has happened yet.</li>}
        {shown?.map((item, i) => {
          const Icon = ICONS[item.type];
          const href = hrefFor(item);
          const { text, link } = invoiceActivityText(item, currency);
          const sub = [item.type === "auto_reminder_sent" ? null : item.actorName, when(item.at)].filter(Boolean).join(" · ");
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="invoice-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full border", TONE[item.type] ?? "border-border bg-surface-sunken text-on-surface-muted")} aria-hidden>
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-on-surface">
                  <span className="font-semibold">{text}</span>
                  {link && (
                    <>
                      {" · "}
                      {href ? (
                        <Link href={href} className="font-medium text-primary hover:underline">
                          {link}
                        </Link>
                      ) : (
                        <span className="font-medium">{link}</span>
                      )}
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{sub}</p>
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              Show {items.length - SHOWN} earlier
            </button>
          </li>
        )}
      </ol>
    </Card>
  );
}
