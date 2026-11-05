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
import { t, useT } from "../../../../lib/i18n";

const TABS = [
  { value: "received", label: t("reports.payments.tabReceived"), href: "/reports/payments-received" },
  { value: "made", label: t("reports.payments.tabMade"), href: "/reports/payments-made" },
];

/**
 * US-RPT-30 — `ReportsPaymentsRegister`: money received from customers or
 * paid to vendors in a range, with the money account and what each payment
 * was allocated to. "Account" narrows to one money account.
 */
export function PaymentRegisters({ tab }: { tab: "received" | "made" }) {
  const t = useT();
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
  const who = tab === "received" ? t("reports.common.customer") : t("reports.common.vendor");

  const columns: TableColumn<PaymentRegisterRow>[] = [
    {
      key: "number",
      header: t("reports.common.number"),
      render: (r) => (
        <Link href={r.href} className="font-medium text-primary hover:underline">
          {r.number ?? "—"}
        </Link>
      ),
      sortValue: (r) => r.number ?? "",
    },
    { key: "date", header: t("reports.common.date"), render: (r) => <span className="whitespace-nowrap">{day(r.date)}</span>, sortValue: (r) => r.date },
    { key: "contact", header: who, render: (r) => r.contact.name, sortValue: (r) => r.contact.name },
    { key: "method", header: t("reports.payments.method"), render: (r) => PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method },
    { key: "account", header: t("reports.common.account"), render: (r) => r.moneyAccount?.name ?? "—" },
    { key: "amount", header: t("reports.common.amount"), align: "right", render: (r) => <span className="tabular-nums">{money(r.amount)}</span>, sortValue: (r) => BigInt(r.amount) },
    {
      key: "allocated",
      header: t("reports.payments.allocatedTo"),
      render: (r) => (
        <span className="flex flex-wrap gap-x-2">
          {r.allocations.map((a, i) => (
            <Fragment key={a.documentId}>
              <Link href={a.href} className="text-primary hover:underline">
                {a.number ?? "—"}
                {a.opening ? t("reports.payments.opening") : ""}
              </Link>
              {i < r.allocations.length - 1 && <span aria-hidden>·</span>}
            </Fragment>
          ))}
          {BigInt(r.heldAsCredit) > 0n && <span className="text-on-surface-muted">{r.allocations.length ? t("reports.payments.heldAsCreditAmount", { amount: money(r.heldAsCredit) }) : t("reports.payments.heldAsCredit")}</span>}
          {BigInt(r.refunded) > 0n && <span className="text-on-surface-muted">{t("reports.payments.refundedAmount", { amount: money(r.refunded) })}</span>}
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
            <ReportFilter label={t("reports.common.account")}>
              {(id) => (
                <Select value={account} onValueChange={setAccount}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("reports.common.allAccounts")}</SelectItem>
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
          <StatCard label={t("reports.payments.payments")} value={String(report.totals.count)} />
          <StatCard label={tab === "received" ? t("reports.payments.received") : t("reports.payments.paid")} value={money(report.totals.amount)} />
          <StatCard
            label={tab === "received" ? t("reports.payments.heldAsCredit") : t("reports.payments.notYetApplied")}
            value={money(report.totals.heldAsCredit)}
            trend={{ direction: "neutral", label: t("reports.payments.count", { count: report.totals.heldCount }) }}
          />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Wallet />} title={tab === "received" ? t("reports.payments.emptyReceived") : t("reports.payments.emptyMade")} description={t("reports.payments.emptyDescription")} />
        </div>
      ) : (
        report &&
        !error && (
          <div data-testid="register-table">
            <DataTable
              columns={columns}
              data={report.rows}
              rowKey={(r) => r.id}
              searchPlaceholder={t("reports.payments.search")}
              searchKey={(r) => `${r.number ?? ""} ${r.contact.name} ${r.allocations.map((a) => a.number).join(" ")}`}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ number: t("reports.common.total"), amount: money(report.totals.amount) }}
            />
          </div>
        )
      )}
    </>
  );
}
