"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Alert, AlertDescription, Button, Checkbox, DatePicker, EmptyState, Label, MultiSelect, PaginationBar, Spinner } from "@spine/ui";
import type { GeneralLedgerAccount, GeneralLedgerReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDay = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The first day of the current quarter. */
function quarterStart(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
}

/**
 * US-RPT-24 — `ReportsGeneralLedger`: each account's opening balance, one
 * row per entry with a running balance, and its closing balance. Paged by
 * account; a row's source opens its document.
 */
export function GeneralLedger() {
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [hideInactive, setHideInactive] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
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

  async function load(next: { page?: number; pageSize?: number; hideInactive?: boolean } = {}) {
    const query = new URLSearchParams({
      from: iso(from),
      to: iso(to),
      includeInactive: String(!(next.hideInactive ?? hideInactive)),
      page: String(next.page ?? page),
      pageSize: String(next.pageSize ?? pageSize),
    });
    if (accountIds.length) query.set("accountIds", accountIds.join(","));
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<GeneralLedgerReport>(`/reports/general-ledger?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The general ledger didn't load. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh", the checkbox and paging reload after that.
  }, []);

  const drCr = (v: string) => {
    const n = BigInt(v);
    if (n === 0n) return formatMoney(0n, currency);
    return `${formatMoney(n < 0n ? -n : n, currency)} ${n < 0n ? "Cr" : "Dr"}`;
  };
  const amount = (v: string) => (BigInt(v) === 0n ? "" : formatMoney(v, currency));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={(d) => d && setFrom(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={(d) => d && setTo(d)} />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label id="gl-accounts-label">Accounts</Label>
          <MultiSelect aria-labelledby="gl-accounts-label" options={options} value={accountIds} onValueChange={setAccountIds} placeholder={hideInactive ? "All accounts with activity" : "All accounts"} />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-[14px] text-on-surface">
          <Checkbox
            checked={hideInactive}
            onCheckedChange={(checked) => {
              setHideInactive(checked === true);
              setPage(1);
              void load({ hideInactive: checked === true, page: 1 });
            }}
          />
          Hide accounts with no activity
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setPage(1);
            void load({ page: 1 });
          }}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        <div className="ml-auto">
          <ReportExportMenu path={`/reports/general-ledger?from=${iso(from)}&to=${iso(to)}&includeInactive=${!hideInactive}${accountIds.length ? `&accountIds=${accountIds.join(",")}` : ""}`} />
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && report.accounts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BookOpen />} title="Nothing posted in this period" description="Pick other dates, or untick “Hide accounts with no activity” to see every account." />
        </div>
      )}

      {report?.accounts.map((a) => <AccountLedger key={a.account.id} ledger={a} drCr={drCr} amount={amount} />)}

      {report && report.totalAccounts > 0 && (
        <PaginationBar
          page={report.page}
          pageSize={report.pageSize}
          total={report.totalAccounts}
          onPageChange={(p) => {
            setPage(p);
            void load({ page: p });
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            void load({ page: 1, pageSize: size });
          }}
        />
      )}
    </div>
  );
}

function AccountLedger({ ledger, drCr, amount }: { ledger: GeneralLedgerAccount; drCr: (v: string) => string; amount: (v: string) => string }) {
  const title = `${ledger.account.code} — ${ledger.account.name}`;
  return (
    <section className="flex flex-col gap-3" aria-label={title} data-testid={`gl-account-${ledger.account.code}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-on-surface">{title}</h2>
        <p className="text-[14px] tabular-nums text-on-surface-muted">Opening balance {drCr(ledger.openingBalance)}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-border text-left text-on-surface">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Contact · description</th>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 text-right font-medium">Debit</th>
              <th className="px-4 py-3 text-right font-medium">Credit</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.length === 0 && (
              <tr className="border-b border-border">
                <td colSpan={7} className="px-4 py-3 text-on-surface-muted">
                  No entries in this period.
                </td>
              </tr>
            )}
            {ledger.rows.map((r) => (
              <tr key={r.journalLineId} className="border-b border-border">
                <td className="whitespace-nowrap px-4 py-3 text-on-surface">{shortDay(r.date)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.href ? (
                    <Link href={r.href} className="text-primary hover:underline">
                      {r.label}
                    </Link>
                  ) : (
                    <span className="text-on-surface">{r.label}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface">{[r.contact?.name, r.description].filter(Boolean).join(" · ") || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-on-surface">{r.job ? (r.job.number ?? r.job.name) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{amount(r.debit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{amount(r.credit)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{drCr(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-on-surface">
              <td colSpan={6} className="px-4 py-3 text-right">
                Closing balance
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums" data-testid="gl-closing">
                {drCr(ledger.closingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
