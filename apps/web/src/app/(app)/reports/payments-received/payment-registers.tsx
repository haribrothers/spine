"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, type TableColumn } from "@spine/ui";
import { periodLabel, type PaymentRegisterReport, type PaymentRegisterRow } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../payments/types";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { day, iso, quarterStart, RangeBar, ReportTabs, useCurrency } from "../analysis-shared";

const TABS = [
  { value: "received", label: "Payments received", href: "/reports/payments-received" },
  { value: "made", label: "Payments made", href: "/reports/payments-made" },
];

/**
 * US-RPT-30 — `ReportsPaymentsRegister`: money received from customers or
 * paid to vendors in a range, with the money account and what each payment
 * was allocated to. "Account" narrows to one money account.
 */
export function PaymentRegisters({ tab }: { tab: "received" | "made" }) {
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [account, setAccount] = useState("all");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [report, setReport] = useState<PaymentRegisterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient
      .get<{ id: string; name: string }[]>("/money-accounts?includeArchived=true")
      .then(setAccounts)
      .catch(() => {});
  }, []);

  async function load(moneyAccount = account) {
    setLoading(true);
    setError(null);
    try {
      const query = `from=${iso(from)}&to=${iso(to)}${moneyAccount === "all" ? "" : `&moneyAccountId=${moneyAccount}`}`;
      setReport(await apiClient.get<PaymentRegisterReport>(`/reports/payments-${tab}?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This report didn't load. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" and "Account" reload after that.
  }, []);

  const money = (v: string) => formatMoney(v, currency);
  const who = tab === "received" ? "Customer" : "Vendor";

  const columns: TableColumn<PaymentRegisterRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (r) => (
        <Link href={r.href} className="font-medium text-primary hover:underline">
          {r.number ?? "—"}
        </Link>
      ),
      sortValue: (r) => r.number ?? "",
    },
    { key: "date", header: "Date", render: (r) => <span className="whitespace-nowrap">{day(r.date)}</span>, sortValue: (r) => r.date },
    { key: "contact", header: who, render: (r) => r.contact.name, sortValue: (r) => r.contact.name },
    { key: "method", header: "Method", render: (r) => PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method },
    { key: "account", header: "Account", render: (r) => r.moneyAccount?.name ?? "—" },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="tabular-nums">{money(r.amount)}</span>, sortValue: (r) => BigInt(r.amount) },
    {
      key: "allocated",
      header: "Allocated to",
      render: (r) => (
        <span className="flex flex-wrap gap-x-2">
          {r.allocations.map((a, i) => (
            <Fragment key={a.documentId}>
              <Link href={a.href} className="text-primary hover:underline">
                {a.number ?? "—"}
                {a.opening ? " (opening)" : ""}
              </Link>
              {i < r.allocations.length - 1 && <span aria-hidden>·</span>}
            </Fragment>
          ))}
          {BigInt(r.heldAsCredit) > 0n && <span className="text-on-surface-muted">{r.allocations.length ? `${money(r.heldAsCredit)} held as credit` : "Held as credit"}</span>}
          {BigInt(r.refunded) > 0n && <span className="text-on-surface-muted">{money(r.refunded)} refunded</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-4 text-[14px] text-on-surface-muted">{periodLabel(iso(from), iso(to))}</p>
      <ReportTabs value={tab} tabs={TABS} />
      <div className="flex flex-wrap items-end gap-3">
        <RangeBar from={from} to={to} onFrom={setFrom} onTo={setTo} onRefresh={() => load()} loading={loading} />
        <div className="flex flex-col gap-1.5">
          <Label id="register-account-label">Account</Label>
          <Select
            value={account}
            onValueChange={(v) => {
              setAccount(v);
              void load(v);
            }}
          >
            <SelectTrigger className="w-56" aria-labelledby="register-account-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <ReportExportMenu path={`/reports/payments-${tab}?from=${iso(from)}&to=${iso(to)}${account === "all" ? "" : `&moneyAccountId=${account}`}`} search={search} />
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="register-cards">
          <StatCard label="Payments" value={String(report.totals.count)} />
          <StatCard label={tab === "received" ? "Received" : "Paid"} value={money(report.totals.amount)} />
          <StatCard
            label={tab === "received" ? "Held as credit" : "Not yet applied to bills"}
            value={money(report.totals.heldAsCredit)}
            trend={{ direction: "neutral", label: `${report.totals.heldCount} ${report.totals.heldCount === 1 ? "payment" : "payments"}` }}
          />
        </div>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Wallet />} title={tab === "received" ? "No payments received in this period" : "No payments made in this period"} description="Pick other dates or another account." />
        </div>
      ) : (
        report &&
        !error && (
          <div data-testid="register-table">
            <DataTable columns={columns} data={report.rows} rowKey={(r) => r.id} searchPlaceholder="Search payments" searchKey={(r) => `${r.number ?? ""} ${r.contact.name} ${r.allocations.map((a) => a.number).join(" ")}`} onSearchChange={setSearch} configurablePageSize />
          </div>
        )
      )}
    </div>
  );
}
