"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, ListChecks, Package, UserPlus } from "lucide-react";
import { Button } from "@spine/ui";
import { setupProgress, type SetupCardStatus } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { SettingsDialog } from "../../../components/settings-dialog";

export interface FinishSummary {
  businessName?: string;
  /** "INR · India (GST)". */
  money: string;
  invoiceNumber: string;
  invitesSent: number;
}

const NEXT = [
  { title: "Add your first customer", action: "Add customer", href: "/contacts/new", icon: UserPlus, tone: "bg-info-bg text-primary" },
  { title: "Add something you sell", action: "Open catalogue", href: "/catalog", icon: Package, tone: "bg-paid-bg text-paid" },
  { title: "Send your first quote", action: "New quote", href: "/quotes/new", icon: FileText, tone: "bg-due-soon-bg text-due-soon" },
] as const;

/**
 * US-ONB-23 (D-208) — after the Team step: what was set (each with a way to
 * change it), the first three things to do and how much of Set up Spine is
 * left. Onboarding is already marked finished when this shows.
 */
export function FinishStep({ summary, onDashboard }: { summary: FinishSummary; onDashboard: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [pane, setPane] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ cards: SetupCardStatus[] }>("/org/setup-status")
      .then((res) => {
        if (!cancelled) setLeft(setupProgress(res.cards).toDo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const team = summary.invitesSent === 0 ? "Just you for now" : summary.invitesSent === 1 ? "1 invite sent" : `${summary.invitesSent} invites sent`;
  const rows: { label: string; value: string; pane?: string; href?: string }[] = [
    { label: "Business", value: summary.businessName || "Not set yet", pane: "business" },
    { label: "Money", value: summary.money, pane: "currency" },
    { label: "Documents", value: `First invoice ${summary.invoiceNumber}`, pane: "numbering" },
    { label: "Team", value: team, href: "/team/users" },
  ];

  return (
    <div className="flex flex-col" data-testid="onboarding-finish">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-layer-top-from),var(--color-brand-layer-top-to)_55%,var(--color-brand-deep))] text-on-primary" aria-hidden>
        <Check size={32} />
      </span>
      <h1 className="mt-[18px] text-[32px] font-bold leading-tight tracking-tight text-on-surface">You&apos;re set up</h1>
      <p className="mt-3 text-[15px] text-on-surface-muted">{summary.businessName ? `Spine is ready for ${summary.businessName}.` : "Spine is ready."}</p>

      <dl className="mt-6 rounded-xl border border-border bg-surface">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border px-4 py-2.5 text-[13px] first:border-t-0">
            <dt className="text-[12px] font-medium text-on-surface-muted">{row.label}</dt>
            <dd className="truncate text-on-surface">{row.value}</dd>
            {row.pane ? (
              <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => setPane(row.pane!)} aria-label={`Change ${row.label.toLowerCase()}`}>
                Change
              </button>
            ) : (
              <Link href={row.href!} className="text-[13px] font-medium text-primary hover:underline" aria-label={`Change ${row.label.toLowerCase()}`}>
                Change
              </Link>
            )}
          </div>
        ))}
      </dl>

      <h2 className="mt-6 text-[14px] font-semibold text-on-surface">What to do next</h2>
      <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
        {NEXT.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-[13px] font-semibold leading-snug text-on-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${item.tone}`}>
                <item.icon size={17} aria-hidden />
              </span>
              {item.title}
              <span className="mt-auto flex items-center gap-1 text-[12px] font-medium text-primary">
                {item.action}
                <ArrowRight size={12} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/setup" className="mt-3.5 flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
        <ListChecks size={15} aria-hidden />
        {left === null ? "See what's left to set up" : `See what's left to set up — ${left} left`}
      </Link>

      <Button size="touch" className="mt-6" onClick={onDashboard}>
        Go to dashboard
        <ArrowRight size={16} aria-hidden />
      </Button>

      <SettingsDialog open={pane !== null} onOpenChange={(open) => !open && setPane(null)} isOwner initialKey={pane} />
    </div>
  );
}
