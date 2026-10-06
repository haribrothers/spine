"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  DatePicker,
  EmptyState,
  Input,
  Label,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { LEDGER_SOURCE_KINDS, type DayBookEntry, type DayBookReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const searchText = (e: DayBookEntry) => `${e.label} ${e.contact?.name ?? ""} ${e.narration ?? ""} ${e.lines.map((l) => `${l.account.code} ${l.account.name}`).join(" ")}`.toLowerCase();

/**
 * US-RPT-25 — `ReportsDayBook`: every journal entry in date order with its
 * lines. Today by default; "Source" narrows to one kind; an entry's source
 * opens its document.
 */
export function DayBook() {
  const [from, setFrom] = useState<Date>(() => new Date());
  const [to, setTo] = useState<Date>(() => new Date());
  const [sourceType, setSourceType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<DayBookReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, []);

  async function load(kind = sourceType) {
    const query = new URLSearchParams({ from: iso(from), to: iso(to) });
    if (kind !== "all") query.set("sourceType", kind);
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<DayBookReport>(`/reports/day-book?${query}`));
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The day book didn't load. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" and "Source" reload after that.
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.entries ?? []).filter((e) => !q || searchText(e).includes(q));
  }, [report, search]);
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totals = filtered.reduce((t, e) => e.lines.reduce((s, l) => ({ debit: s.debit + BigInt(l.debit), credit: s.credit + BigInt(l.credit) }), t), { debit: 0n, credit: 0n });
  const amount = (v: string | bigint) => (BigInt(v) === 0n ? "" : formatMoney(v, currency));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={(d) => d && setFrom(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={(d) => d && setTo(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="day-book-source-label">Source</Label>
          <Select
            value={sourceType}
            onValueChange={(v) => {
              setSourceType(v);
              void load(v);
            }}
          >
            <SelectTrigger className="w-56" aria-labelledby="day-book-source-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {LEDGER_SOURCE_KINDS.map((k) => (
                <SelectItem key={k.key} value={k.key}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" onClick={() => load()} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        <div className="ml-auto">
          <ReportExportMenu path={`/reports/day-book?from=${iso(from)}&to=${iso(to)}${sourceType === "all" ? "" : `&sourceType=${sourceType}`}`} search={search} />
        </div>
      </div>

      <div className="relative w-full max-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-muted" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Search entries"
          aria-label="Search entries"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BookOpen />} title={search ? "No entries match your search" : "Nothing posted on these dates"} description={search ? "Clear the search or try other words." : "Pick other dates or another source."} />
        </div>
      ) : (
        report &&
        !error && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-[14px]" data-testid="day-book-table">
                <thead>
                  <tr className="border-b border-border text-left text-on-surface">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Contact · narration</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <Fragment key={e.entryId}>
                      {e.lines.map((l, i) => (
                        <tr key={`${e.entryId}-${i}`} className="border-b border-border" data-testid={i === 0 ? "day-book-entry" : undefined}>
                          <td className="whitespace-nowrap px-4 py-3 text-on-surface">{i === 0 ? day(e.date) : ""}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {i === 0 &&
                              (e.href ? (
                                <Link href={e.href} className="text-primary hover:underline">
                                  {e.label}
                                </Link>
                              ) : (
                                <span className="text-on-surface">{e.label}</span>
                              ))}
                          </td>
                          <td className="px-4 py-3 text-on-surface">{i === 0 ? [e.contact?.name, e.description].filter(Boolean).join(" · ") : ""}</td>
                          <td className="px-4 py-3 text-on-surface">
                            {l.account.code} · {l.account.name}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{amount(l.debit)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{amount(l.credit)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-on-surface">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" data-testid="day-book-total-debit">
                      {formatMoney(totals.debit, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" data-testid="day-book-total-credit">
                      {formatMoney(totals.credit, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
        )
      )}
    </div>
  );
}
