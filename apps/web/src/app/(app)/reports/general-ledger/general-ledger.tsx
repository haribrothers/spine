"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Alert, AlertDescription, EmptyState, MultiSelect, PaginationBar, ReportFilter, ReportFilterCheckbox, StatCard, StatementTable } from "@spine/ui";
import { ReportToolbar } from "../../../../components/report-toolbar";
import type { GeneralLedgerAccount, GeneralLedgerReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { filterSummary, RangeFilters, rangeSummary, ReportKpis, useReport } from "../report-kit";
import { t, useT } from "../../../../lib/i18n";

const shortDay = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric" });

/** The general ledger and the day book are siblings: tabs switch between them. */
export const LEDGER_TABS = [
  { value: "general-ledger", label: t("reports.generalLedger.tabGeneralLedger"), href: "/reports/general-ledger" },
  { value: "day-book", label: t("reports.generalLedger.tabDayBook"), href: "/reports/day-book" },
];

/**
 * US-RPT-24 — `ReportsGeneralLedger`: each account's opening balance, one
 * row per entry with a running balance, and its closing balance. Paged by
 * account; a row's source opens its document.
 */
export function GeneralLedger() {
  const t = useT();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [hideInactive, setHideInactive] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    apiClient
      .get<Record<string, { id: string; code: string; name: string }[]>>("/org/accounts")
      .then((grouped) =>
        setOptions(
          Object.values(grouped)
            .flat()
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
        ),
      )
      .catch(() => {});
  }, []);

  // A new filter starts again from the first page.
  const refilter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const filters = `from=${iso(from)}&to=${iso(to)}&includeInactive=${!hideInactive}${accountIds.length ? `&accountIds=${accountIds.join(",")}` : ""}`;
  const { data: report, error, loading } = useReport<GeneralLedgerReport>(`/reports/general-ledger?${filters}&page=${page}&pageSize=${pageSize}`);

  const drCr = (v: string) => {
    const n = BigInt(v);
    if (n === 0n) return formatMoney(0n, currency);
    return `${formatMoney(n < 0n ? -n : n, currency)} ${n < 0n ? t("reports.common.creditSide") : t("reports.common.debitSide")}`;
  };
  const amount = (v: string) => (BigInt(v) === 0n ? "" : formatMoney(v, currency));

  return (
    <>
      <ReportTabs value="general-ledger" tabs={LEDGER_TABS} />
      <ReportToolbar
        loading={loading}
        summary={filterSummary(
          rangeSummary(from, to),
          accountIds.length === 1 ? (options.find((o) => o.value === accountIds[0])?.label ?? t("reports.generalLedger.accountCount", { count: 1 })) : accountIds.length > 1 && t("reports.generalLedger.accountCount", { count: accountIds.length }),
          hideInactive && t("reports.generalLedger.hideInactive"),
        )}
        filters={
          <>
            <RangeFilters from={from} to={to} onFrom={refilter(setFrom)} onTo={refilter(setTo)} />
            <ReportFilter label={t("reports.common.accounts")} className="w-72">
              {(id) => <MultiSelect aria-labelledby={id} options={options} value={accountIds} onValueChange={refilter(setAccountIds)} placeholder={hideInactive ? t("reports.generalLedger.allAccountsWithActivity") : t("reports.common.allAccounts")} />}
            </ReportFilter>
            <ReportFilterCheckbox label={t("reports.generalLedger.hideInactive")} checked={hideInactive} onCheckedChange={refilter(setHideInactive)} />
          </>
        }
        actions={!error && <ReportExportMenu path={`/reports/general-ledger?${filters}`} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <ReportKpis count={4} data-testid="gl-cards">
          <StatCard label={t("reports.common.accounts")} value={String(report.totalAccounts)} />
          <StatCard label={t("reports.generalLedger.lines")} value={String(report.totals.lines)} />
          <StatCard label={t("reports.common.totalDebits")} value={formatMoney(report.totals.debit, currency)} />
          <StatCard label={t("reports.common.totalCredits")} value={formatMoney(report.totals.credit, currency)} />
        </ReportKpis>
      )}

      {report && !error && report.accounts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BookOpen />} title={t("reports.generalLedger.emptyTitle")} description={t("reports.generalLedger.emptyDescription")} />
        </div>
      )}

      {!error && report?.accounts.map((a) => <AccountLedger key={a.account.id} ledger={a} drCr={drCr} amount={amount} />)}

      {report && !error && report.totalAccounts > 0 && (
        <PaginationBar
          page={report.page}
          pageSize={report.pageSize}
          total={report.totalAccounts}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </>
  );
}

function AccountLedger({ ledger, drCr, amount }: { ledger: GeneralLedgerAccount; drCr: (v: string) => string; amount: (v: string) => string }) {
  const t = useT();
  const title = `${ledger.account.code} — ${ledger.account.name}`;
  return (
    <section className="flex flex-col gap-3" aria-label={title} data-testid={`gl-account-${ledger.account.code}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-on-surface">{title}</h2>
        <p className="text-[13px] tabular-nums text-on-surface-muted">{t("reports.generalLedger.openingBalance", { amount: drCr(ledger.openingBalance) })}</p>
      </div>
      <StatementTable
        columns={[
          { key: "date", header: t("reports.common.date") },
          { key: "source", header: t("reports.common.source") },
          { key: "detail", header: t("reports.generalLedger.detail") },
          { key: "job", header: t("reports.common.job") },
          { key: "debit", header: t("reports.common.debit"), align: "right" },
          { key: "credit", header: t("reports.common.credit"), align: "right" },
          { key: "balance", header: t("reports.generalLedger.balance"), align: "right" },
        ]}
        rows={[
          ...(ledger.rows.length === 0 ? [{ kind: "empty" as const, key: "none", label: t("reports.generalLedger.noEntries") }] : []),
          ...ledger.rows.map((r) => ({
            kind: "line" as const,
            key: r.journalLineId,
            cells: {
              date: <span className="whitespace-nowrap">{shortDay(r.date)}</span>,
              source: r.href ? (
                <Link href={r.href} className="whitespace-nowrap text-primary hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span className="whitespace-nowrap">{r.label}</span>
              ),
              detail: [r.contact?.name, r.description].filter(Boolean).join(" · ") || "—",
              job: <span className="whitespace-nowrap">{r.job ? (r.job.number ?? r.job.name) : "—"}</span>,
              debit: amount(r.debit),
              credit: amount(r.credit),
              balance: drCr(r.balance),
            },
          })),
          { kind: "total" as const, key: "closing", cells: { date: t("reports.generalLedger.closingBalance"), balance: <span data-testid="gl-closing">{drCr(ledger.closingBalance)}</span> } },
        ]}
      />
    </section>
  );
}
