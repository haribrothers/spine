"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card } from "@spine/ui";
import type { QuoteRelated as QuoteRelatedData } from "@spine/shared";
import { FileText, HardHat, Receipt, Target } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { orgLocaleTag } from "../../../lib/money";
import { STATUS_BADGE_CLASS } from "./quotes-table";
import { QUOTE_STATUS_LABELS } from "./types";

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted">{children}</h4>;
}

/**
 * US-QUO-33 (D-214) — what a quote is connected to: the lead it's for,
 * every version, and the jobs and invoices made from any of them. Not shown
 * when there's nothing but this quote.
 */
export function QuoteRelated({ quoteId, refreshKey }: { quoteId: string; refreshKey?: unknown }) {
  const [data, setData] = useState<QuoteRelatedData | null>(null);

  useEffect(() => {
    apiClient
      .get<QuoteRelatedData>(`/quotes/${quoteId}/related`)
      .then(setData)
      .catch(() => setData(null));
  }, [quoteId, refreshKey]);

  if (!data) return null;
  const hasVersions = data.versions.length > 1;
  if (!data.lead && !hasVersions && !data.jobs.length && !data.invoices.length) return null;
  const locale = orgLocaleTag();

  return (
    <Card className="flex flex-col p-0" data-testid="quote-related">
      <h3 className="px-4 pt-4 text-[14px] font-semibold text-on-surface">Related</h3>
      <div className="flex flex-col px-4 pb-3">
        {data.lead && (
          <>
            <Heading>Lead</Heading>
            <div className="flex items-center gap-2 py-1.5 text-[13px]">
              <Target size={14} className="text-on-surface-muted" aria-hidden />
              <Link href={`/leads?lead=${data.lead.id}`} className="font-medium text-primary hover:underline">
                {data.lead.title || "Untitled lead"}
              </Link>
            </div>
          </>
        )}
        {hasVersions && (
          <>
            <Heading>Versions</Heading>
            <ul className="flex flex-col">
              {data.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <FileText size={14} className="text-on-surface-muted" aria-hidden />
                  {v.id === quoteId ? (
                    <span className="font-semibold text-on-surface">v{v.version}</span>
                  ) : (
                    <Link href={`/quotes/${v.id}`} className="font-medium text-primary hover:underline" aria-label={`Version ${v.version}${v.number ? `, ${v.number}` : ""}`}>
                      v{v.version}
                    </Link>
                  )}
                  <Badge className={STATUS_BADGE_CLASS[v.status]}>{QUOTE_STATUS_LABELS[v.status]}</Badge>
                  {v.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
                  <span className="ml-auto text-[12px] text-on-surface-muted">
                    {v.id === quoteId ? "this one" : new Date(v.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {(data.jobs.length > 0 || data.invoices.length > 0) && (
          <>
            <Heading>Made from this quote</Heading>
            <ul className="flex flex-col">
              {data.jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <HardHat size={14} className="text-on-surface-muted" aria-hidden />
                  <Link href={`/jobs/${j.id}`} className="min-w-0 truncate font-medium text-primary hover:underline">
                    {j.number ? `${j.number} · ${j.name}` : j.name}
                  </Link>
                  <span className="ml-auto text-[12px] capitalize text-on-surface-muted">{j.status.replace(/_/g, " ")}</span>
                </li>
              ))}
              {data.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <Receipt size={14} className="text-on-surface-muted" aria-hidden />
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                    {inv.number ?? "Draft invoice"}
                  </Link>
                  <span className="ml-auto text-[12px] capitalize text-on-surface-muted">{inv.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
