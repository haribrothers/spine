"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, StatusChip } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { t as translate, useT } from "../../../../lib/i18n";

interface MyExpense {
  id: string;
  categoryName: string | null;
  date: string;
  amount: string;
  currency: string;
  status: "submitted" | "approved" | "rejected";
}

const STATUS: Record<MyExpense["status"], { label: string; chip: "paid" | "overdue" | "draft" }> = {
  approved: { label: translate("dashboard.myExpenses.approved"), chip: "paid" },
  rejected: { label: translate("dashboard.myExpenses.rejected"), chip: "overdue" },
  submitted: { label: translate("dashboard.myExpenses.submitted"), chip: "draft" },
};

/** "Mon 6 Oct". */
function shortDay(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(orgLocaleTag(), { weekday: "short", day: "numeric", month: "short" });
}

/** US-DASH-18 — the member's last 5 expenses: category, date, amount and status. */
export function MyExpenses() {
  const t = useT();
  const [expenses, setExpenses] = useState<MyExpense[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<MyExpense[]>("/expenses?mine=true")
      .then((rows) => setExpenses(rows.slice(0, 5)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <Card data-testid="my-expenses">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          {t("dashboard.widgets.myExpenses")}
          <Link href="/expenses?new=1" className="text-[13px] font-normal text-primary hover:underline">
            {t("dashboard.myExpenses.submit")}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!expenses ? (
          <WidgetSkeleton kind="rows" rows={4} />
        ) : expenses.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">{t("dashboard.myExpenses.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {expenses.map((e) => (
              <li key={e.id}>
                <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-3 rounded-sm py-2.5 hover:bg-surface-sunken">
                  <span className="flex flex-col">
                    <span className="text-[14px] text-on-surface">{e.categoryName ?? t("dashboard.myExpenses.expense")}</span>
                    <span className="text-[12px] text-on-surface-muted">{shortDay(e.date)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[14px] tabular-nums text-on-surface">{formatMoney(BigInt(e.amount), e.currency)}</span>
                    <StatusChip status={STATUS[e.status].chip}>{STATUS[e.status].label}</StatusChip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
