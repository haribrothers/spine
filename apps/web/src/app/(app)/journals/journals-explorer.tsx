"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  AppShellHeader,
  Button,
  DataTable,
  DatePicker,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  StatusChip,
  type TableColumn,
} from "@spine/ui";
import { NO_JOURNALS, type ManualJournal } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { JournalDialog } from "./journal-dialog";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { PrintHeader, PrintRangeProvider } from "../../../components/print-header";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });

/** The start of the current financial year (Settings › Financial year). */
function financialYearStart(start: { month: number; day: number }): string {
  const today = new Date();
  const thisYear = new Date(today.getFullYear(), start.month - 1, start.day);
  return iso(thisYear <= today ? thisYear : new Date(today.getFullYear() - 1, start.month - 1, start.day));
}

/**
 * US-RPT-20, US-RPT-22 — `ManualJournalsList`: every journal, newest first,
 * with its number, date, reason, total, status and who posted it. Members
 * with "View ledger / journals" can read; only an Owner posts or reverses.
 */
export function JournalsExplorer() {
  const t = useT();
  const router = useRouter();
  const isOwner = useMyRole() === "owner";
  const [rows, setRows] = useState<ManualJournal[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [yearStart, setYearStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [status, setStatus] = useState<"all" | "posted" | "reversed">("all");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    apiClient.get<ManualJournal[]>("/manual-journals").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
    apiClient
      .get<{ value: { month: number; day: number } | null }>("/org/settings/financial_year_start")
      .then((res) => res.value && setYearStart(financialYearStart(res.value)))
      .catch(() => {});
  }, [load]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (j) => (status === "all" || j.status === status) && (!from || j.date >= iso(from)) && (!to || j.date <= iso(to)),
      ),
    [rows, status, from, to],
  );
  const posted = (rows ?? []).filter((j) => j.status === "posted");
  const postedThisYear = posted.filter((j) => j.date >= yearStart).reduce((s, j) => s + BigInt(j.total), 0n);
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);

  const columns: TableColumn<ManualJournal>[] = [
    {
      key: "number",
      header: t("journals.list.colNumber"),
      render: (j) => (
        <Link href={`/journals/${j.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
          {j.number}
        </Link>
      ),
      sortValue: (j) => j.number,
    },
    { key: "date", header: t("journals.list.colDate"), render: (j) => day(j.date), sortValue: (j) => j.date },
    { key: "reason", header: t("journals.list.colReason"), render: (j) => j.reason },
    {
      key: "status",
      header: t("journals.list.colStatus"),
      render: (j) => (j.status === "reversed" ? <StatusChip status="draft">{t("journals.list.reversed")}</StatusChip> : <StatusChip status="paid">{t("journals.list.posted")}</StatusChip>),
    },
    { key: "total", header: t("journals.list.colTotal"), align: "right", render: (j) => <span className="tabular-nums">{money(j.total)}</span>, sortValue: (j) => Number(j.total) },
    { key: "by", header: t("journals.list.colBy"), render: (j) => j.postedBy?.name ?? "—" },
  ];

  return (
    <PrintRangeProvider>
      <AppShellHeader
        breadcrumb={[{ label: t("journals.list.breadcrumbReports") }, { label: t("journals.list.title") }]}
        title={t("journals.list.title")}
        description={t("journals.list.description")}
      />
      <PrintHeader />
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="journal-cards">
          <StatCard label={t("journals.list.totalJournals")} value={rows ? String(rows.length) : "—"} />
          <StatCard label={t("journals.list.posted")} value={rows ? String(posted.length) : "—"} />
          <StatCard label={t("journals.list.reversed")} value={rows ? String(rows.length - posted.length) : "—"} />
          <StatCard label={t("journals.list.postedThisYear")} value={money(postedThisYear)} trend={{ direction: "neutral", label: t("journals.list.since", { date: day(yearStart) }) }} />
        </div>
        {/* US-RPT-40 — the list layout: filters on the left, Export then the one primary action on the right. */}
        <div className="flex flex-wrap items-center gap-3" data-print="hide">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-40" aria-label={t("journals.list.statusFilter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("journals.list.allJournals")}</SelectItem>
              <SelectItem value="posted">{t("journals.list.posted")}</SelectItem>
              <SelectItem value="reversed">{t("journals.list.reversed")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-40">
            <DatePicker value={from} onChange={setFrom} placeholder={t("journals.list.from")} />
          </div>
          <div className="w-40">
            <DatePicker value={to} onChange={setTo} placeholder={t("journals.list.to")} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ReportExportMenu path={`/manual-journals?status=${status}${from ? `&from=${iso(from)}` : ""}${to ? `&to=${iso(to)}` : ""}`} search={search} />
            {isOwner && <Button onClick={() => setNewOpen(true)}>{t("journals.list.newJournal")}</Button>}
          </div>
        </div>
        {rows?.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<BookOpen />} title={NO_JOURNALS} description={isOwner ? t("journals.list.emptyOwner") : undefined} />
          </div>
        ) : (
          <div data-testid="journals-table">
            <DataTable columns={columns} data={filtered} rowKey={(j) => j.id} searchPlaceholder={t("journals.list.searchPlaceholder")} searchKey={(j) => `${j.number} ${j.reason} ${j.postedBy?.name ?? ""}`} onSearchChange={setSearch} configurablePageSize />
          </div>
        )}
        <p className="text-[13px] text-on-surface-muted">{t("journals.list.accessNote")}</p>
      </div>
      <JournalDialog open={newOpen} onOpenChange={setNewOpen} currency={currency} onPosted={(j) => router.push(`/journals/${j.id}`)} />
    </PrintRangeProvider>
  );
}
