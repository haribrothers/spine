"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import {
  TOP_EXPENSE_PERIOD_LABELS,
  TOP_EXPENSE_PERIODS,
  type TopExpensePeriod,
  type TopExpenses,
} from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useMyRole } from "../../../../lib/role-context";
import { DrilldownDialog } from "../../reports/reports-explorer";

/**
 * US-DASH-22 (D-160) — `DashboardOwnerBooks` › Top expenses: the five
 * largest expense accounts this month, quarter or financial year as
 * labelled bars with amount and %, and "Other". A bar opens the account
 * drill-down for that period (Owners, or "View ledger / journals"). Not
 * shown without "View financial statements".
 */
export function TopExpensesCard() {
  const [period, setPeriod] = useState<TopExpensePeriod>("quarter");
  const [data, setData] = useState<TopExpenses | null>(null);
  const [failed, setFailed] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [drill, setDrill] = useState<{
    accountId: string;
    code: string;
    name: string;
  } | null>(null);
  const isOwner = useMyRole() === "owner";
  const canReadLedger = useCapability("ledger.view");
  const canDrill = isOwner || canReadLedger;

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    apiClient
      .get<TopExpenses>(`/dashboard/top-expenses?period=${period}`)
      .then(setData)
      .catch(() => setFailed(true));
  }, [period]);

  if (failed) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);
  const bars = data
    ? [
        ...data.rows.map((r) => ({
          key: r.accountId,
          label: r.name,
          amount: r.amount,
          percent: r.percent,
          row: r,
        })),
        ...(data.other
          ? [
              {
                key: "other",
                label: "Other",
                amount: data.other.amount,
                percent: data.other.percent,
                row: null,
              },
            ]
          : []),
      ]
    : [];

  return (
    <Card data-testid="top-expenses">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
          <span>
            Top expenses · {TOP_EXPENSE_PERIOD_LABELS[period].toLowerCase()}
          </span>
          <span className="flex items-center gap-3">
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as TopExpensePeriod)}
            >
              <SelectTrigger
                className="h-8 w-44 text-[13px]"
                aria-label="Period"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_EXPENSE_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {TOP_EXPENSE_PERIOD_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link
              href="/reports/expenses-by-category"
              className="text-[13px] font-normal text-primary hover:underline"
            >
              Expenses by category
            </Link>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : bars.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-on-surface-muted">
            No expenses in this period.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bars.map((b) => (
              <li key={b.key} className="flex flex-col gap-1.5 text-[14px]">
                <div className="flex items-baseline justify-between gap-3">
                  {b.row && canDrill ? (
                    <button
                      type="button"
                      className="truncate text-left text-on-surface hover:text-primary hover:underline"
                      onClick={() =>
                        setDrill({
                          accountId: b.row!.accountId,
                          code: b.row!.code,
                          name: b.row!.name,
                        })
                      }
                    >
                      {b.label}
                    </button>
                  ) : (
                    <span className="truncate text-on-surface">{b.label}</span>
                  )}
                  <span className="whitespace-nowrap text-right tabular-nums text-on-surface">
                    {money(b.amount)}{" "}
                    <span className="text-on-surface-muted">
                      · {b.percent ?? "0.0"}%
                    </span>
                  </span>
                </div>
                <Progress
                  value={Number(b.percent ?? 0)}
                  aria-label={`${b.label}: ${b.percent ?? "0.0"}% of expenses`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {drill && data && (
        <DrilldownDialog
          accountId={drill.accountId}
          accountLabel={`${drill.code} — ${drill.name}`}
          from={data.from}
          to={data.to}
          currency={currency}
          onClose={() => setDrill(null)}
        />
      )}
    </Card>
  );
}
