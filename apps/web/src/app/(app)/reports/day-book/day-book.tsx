"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Alert,
  AlertDescription,
  EmptyState,
  Input,
  PaginationBar,
  ReportFilter,
  ReportToolbar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  StatementTable,
  usePrintMode,
  type StatementRow,
} from "@spine/ui";
import { LEDGER_SOURCE_KINDS, type DayBookEntry, type DayBookReport } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { day, iso, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportKpis, useReport } from "../report-kit";
import { LEDGER_TABS } from "../general-ledger/general-ledger";
import { useT } from "../../../../lib/i18n";

const searchText = (e: DayBookEntry) => `${e.label} ${e.contact?.name ?? ""} ${e.narration ?? ""} ${e.lines.map((l) => `${l.account.code} ${l.account.name}`).join(" ")}`.toLowerCase();

/**
 * US-RPT-25 — `ReportsDayBook`: every journal entry in date order with its
 * lines. Today by default; "Source" narrows to one kind; an entry's source
 * opens its document.
 */
export function DayBook() {
  const t = useT();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(() => new Date());
  const [to, setTo] = useState<Date>(() => new Date());
  const [sourceType, setSourceType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const url = `/reports/day-book?from=${iso(from)}&to=${iso(to)}${sourceType === "all" ? "" : `&sourceType=${sourceType}`}`;
  const { data: report, error, loading } = useReport<DayBookReport>(url);
  const refilter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.entries ?? []).filter((e) => !q || searchText(e).includes(q));
  }, [report, search]);
  // Print shows every entry, not just this page (US-RPT-34).
  const printing = usePrintMode();
  const shown = printing ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  const totals = filtered.reduce((acc, e) => e.lines.reduce((s, l) => ({ debit: s.debit + BigInt(l.debit), credit: s.credit + BigInt(l.credit) }), acc), { debit: 0n, credit: 0n });
  const amount = (v: string | bigint) => (BigInt(v) === 0n ? "" : formatMoney(v, currency));

  const rows: StatementRow[] = [
    ...shown.flatMap((e) =>
      e.lines.map(
        (l, i): StatementRow => ({
          kind: "line",
          key: `${e.entryId}-${i}`,
          testId: i === 0 ? "day-book-entry" : undefined,
          cells: {
            date: i === 0 ? <span className="whitespace-nowrap">{day(e.date)}</span> : "",
            source:
              i === 0 &&
              (e.href ? (
                <Link href={e.href} className="whitespace-nowrap text-primary hover:underline">
                  {e.label}
                </Link>
              ) : (
                <span className="whitespace-nowrap">{e.label}</span>
              )),
            detail: i === 0 ? [e.contact?.name, e.description].filter(Boolean).join(" · ") : "",
            account: `${l.account.code} · ${l.account.name}`,
            debit: amount(l.debit),
            credit: amount(l.credit),
          },
        }),
      ),
    ),
    {
      kind: "total",
      key: "totals",
      cells: {
        date: t("reports.dayBook.totals"),
        debit: <span data-testid="day-book-total-debit">{formatMoney(totals.debit, currency)}</span>,
        credit: <span data-testid="day-book-total-credit">{formatMoney(totals.credit, currency)}</span>,
      },
    },
  ];

  return (
    <>
      <ReportTabs value="day-book" tabs={LEDGER_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <RangeFilters from={from} to={to} onFrom={refilter(setFrom)} onTo={refilter(setTo)} />
            <ReportFilter label={t("reports.common.source")}>
              {(id) => (
                <Select value={sourceType} onValueChange={refilter(setSourceType)}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("reports.dayBook.allSources")}</SelectItem>
                    {LEDGER_SOURCE_KINDS.map((k) => (
                      <SelectItem key={k.key} value={k.key}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
          </>
        }
        actions={!error && <ReportExportMenu path={url} search={search} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <ReportKpis count={3} data-testid="day-book-cards">
            <StatCard label={t("reports.dayBook.entries")} value={String(filtered.length)} />
            <StatCard label={t("reports.common.totalDebits")} value={formatMoney(totals.debit, currency)} />
            <StatCard label={t("reports.common.totalCredits")} value={formatMoney(totals.credit, currency)} />
          </ReportKpis>

          <div className="flex flex-col gap-3">
            <div data-print="hide">
              <Input
                className="w-64"
                placeholder={t("reports.dayBook.search")}
                aria-label={t("reports.dayBook.search")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface">
                <EmptyState icon={<BookOpen />} title={search ? t("reports.dayBook.emptySearchTitle") : t("reports.dayBook.emptyTitle")} description={search ? t("reports.dayBook.emptySearchDescription") : t("reports.dayBook.emptyDescription")} />
              </div>
            ) : (
              <>
                <StatementTable
                  data-testid="day-book-table"
                  columns={[
                    { key: "date", header: t("reports.common.date") },
                    { key: "source", header: t("reports.common.source") },
                    { key: "detail", header: t("reports.dayBook.detail") },
                    { key: "account", header: t("reports.common.account") },
                    { key: "debit", header: t("reports.common.debit"), align: "right" },
                    { key: "credit", header: t("reports.common.credit"), align: "right" },
                  ]}
                  rows={rows}
                />
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={filtered.length}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
