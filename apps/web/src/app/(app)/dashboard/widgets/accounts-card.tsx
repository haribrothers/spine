"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CreditCard, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import type { MoneyAccount } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

const KIND_ICON = { bank: Landmark, cash: Banknote, card: CreditCard } as const;
const KIND_LABEL = { bank: "Bank account", cash: "Cash", card: "Card" } as const;

/** "Sep 30", or "Sep 30, 2025" outside this year. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/**
 * US-DASH-23 (D-160) — `DashboardOwnerBooks` › Accounts: every active
 * bank, cash and card account with its type, balance (a card's reads as
 * owed) and how far it's reconciled; a name opens its register. Not shown
 * without `banking.view`.
 */
export function AccountsCard() {
  const [rows, setRows] = useState<MoneyAccount[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
    apiClient
      .get<MoneyAccount[]>("/money-accounts")
      .then((all) => setRows(all.filter((a) => !a.archivedAt)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <Card data-testid="accounts-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Accounts
          <Link href="/banking" className="text-[13px] font-normal text-primary hover:underline">
            Banking
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-on-surface-muted">No money accounts yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((a) => {
              const Icon = KIND_ICON[a.kind];
              const balance = BigInt(a.balance ?? "0");
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-on-surface-muted" aria-label={KIND_LABEL[a.kind]} role="img" />
                    <div className="min-w-0">
                      <Link href={`/banking/${a.id}`} className="block truncate text-[14px] text-primary hover:underline">
                        {a.name}
                      </Link>
                      <p className="text-[12px] text-on-surface-muted">{a.lastReconciledOn ? `Reconciled to ${shortDate(a.lastReconciledOn)}` : "Not reconciled"}</p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-on-surface">
                    {formatMoney(balance, currency)}
                    {a.kind === "card" && " owed"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
