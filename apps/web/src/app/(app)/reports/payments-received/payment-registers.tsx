"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, ReportFilter, ReportToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, type TableColumn } from "@spine/ui";
import { type PaymentRegisterReport, type PaymentRegisterRow } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../payments/types";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { day, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportKpis, useReport } from "../report-kit";

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
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient
      .get<{ id: string; name: string }[]>("/money-accounts?includeArchived=true")
      .then(setAccounts)
      .catch(() => {});
  }, []);

  const url = `/reports/payments-${tab}?from=${iso(from)}&to=${iso(to)}${account === "all" ? "" : `&moneyAccountId=${account}`}`;
  const { data: report, error, loading } = useReport<PaymentRegisterReport>(url);

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
    <>
      <ReportTabs value={tab} tabs={TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <ReportFilter label="Account">
              {(id) => (
                <Select value={account} onValueChange={setAccount}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
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
        <ReportKpis count={3} data-testid="register-cards">
          <StatCard label="Payments" value={String(report.totals.count)} />
          <StatCard label={tab === "received" ? "Received" : "Paid"} value={money(report.totals.amount)} />
          <StatCard
            label={tab === "received" ? "Held as credit" : "Not yet applied to bills"}
            value={money(report.totals.heldAsCredit)}
            trend={{ direction: "neutral", label: `${report.totals.heldCount} ${report.totals.heldCount === 1 ? "payment" : "payments"}` }}
          />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Wallet />} title={tab === "received" ? "No payments received in this period" : "No payments made in this period"} description="Pick other dates or another account." />
        </div>
      ) : (
        report &&
        !error && (
          <div data-testid="register-table">
            <DataTable
              columns={columns}
              data={report.rows}
              rowKey={(r) => r.id}
              searchPlaceholder="Search payments"
              searchKey={(r) => `${r.number ?? ""} ${r.contact.name} ${r.allocations.map((a) => a.number).join(" ")}`}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ number: "Total", amount: money(report.totals.amount) }}
            />
          </div>
        )
      )}
    </>
  );
}
