"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
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
  TableSkeleton,
  type TableColumn,
} from "@spine/ui";
import { MONEY_ACCOUNT_KIND_LABELS, type AccountRegister as Register, type AccountRegisterRow } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { formatDay, toIsoDate } from "./dates";

const TABLE_COLUMNS = [
  { key: "date", header: "Date", width: "w-24" },
  { key: "what", header: "What", width: "w-40" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "in", header: "Money in", width: "w-24" },
  { key: "out", header: "Money out", width: "w-24" },
  { key: "balance", header: "Balance", width: "w-24" },
];

/** Where a register row opens its source document; entries without a page aren't links. */
function sourceHref(row: AccountRegisterRow): string | null {
  switch (row.sourceType) {
    case "payment":
    case "payment_delete":
      return `/payments?id=${row.sourceId}`;
    case "vendor_payment":
    case "vendor_payment_delete":
      return `/vendor-payments?id=${row.sourceId}`;
    case "expense":
      return `/expenses?id=${row.sourceId}`;
    default:
      return null;
  }
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * US-BANK-02 — `AccountRegister`: everything that went in or out of one
 * money account, with a running balance that starts from the true balance
 * before the chosen range. A card reads "Paid off" and "Spent".
 */
export function AccountRegisterView({ accountId }: { accountId: string }) {
  const [from, setFrom] = useState<Date>(monthStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const [register, setRegister] = useState<Register | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? "USD"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ from: toIsoDate(from), to: toIsoDate(to), unreconciled: String(unreconciledOnly) });
    apiClient
      .get<Register>(`/money-accounts/${accountId}/register?${query}`)
      .then((res) => {
        setRegister(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this account. Refresh to try again."));
  }, [accountId, from, to, unreconciledOnly]);

  const account = register?.account;
  const isCard = account?.kind === "card";
  const inLabel = isCard ? "Paid off" : "Money in";
  const outLabel = isCard ? "Spent" : "Money out";
  const money = (amount: string) => formatMoney(BigInt(amount), currency);
  const rangeLabel = `${formatDay(toIsoDate(from))} – ${formatDay(toIsoDate(to))}`;

  const columns: TableColumn<AccountRegisterRow>[] = [
    { key: "date", header: "Date", render: (row) => formatDay(row.date), sortValue: (row) => row.date },
    {
      key: "what",
      header: "What",
      render: (row) => {
        const href = sourceHref(row);
        return href ? (
          <Link href={href} className="font-medium text-on-surface hover:text-primary hover:underline">
            {row.what}
          </Link>
        ) : (
          <span className="font-medium text-on-surface">{row.what}</span>
        );
      },
    },
    { key: "contact", header: "Contact", render: (row) => row.contact?.name ?? <span className="text-on-surface-muted">—</span> },
    { key: "reference", header: "Reference", render: (row) => row.reference ?? <span className="text-on-surface-muted">—</span> },
    { key: "in", header: inLabel, align: "right", render: (row) => (row.in !== "0" ? <span className="tabular-nums">{money(row.in)}</span> : null), sortValue: (row) => Number(row.in) },
    { key: "out", header: outLabel, align: "right", render: (row) => (row.out !== "0" ? <span className="tabular-nums">{money(row.out)}</span> : null), sortValue: (row) => Number(row.out) },
    { key: "balance", header: isCard ? "Owed" : "Balance", align: "right", render: (row) => <span className="tabular-nums">{money(row.balance)}</span> },
    {
      key: "status",
      header: "Status",
      render: (row) => (row.reconciled ? <StatusChip status="paid">Reconciled</StatusChip> : <StatusChip status="due-soon">Not reconciled</StatusChip>),
    },
  ];

  const subtitle = account
    ? [account.bankName, account.last4 ? `••${account.last4}` : null, MONEY_ACCOUNT_KIND_LABELS[account.kind], `ledger ${account.code}`].filter(Boolean).join(" · ")
    : undefined;

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Money" }, { label: "Banking", href: "/banking" }, { label: account?.name ?? "Account" }]} title={account?.name ?? "Account"} description={subtitle} />
      {error ? (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={isCard ? "Owed on this card" : "Balance in Spine"}
              value={account ? money(account.balance) : "—"}
              trend={{ direction: "neutral", label: `as of ${formatDay(toIsoDate(new Date()))}` }}
            />
            <StatCard label={inLabel} value={register ? money(register.totalIn) : "—"} trend={{ direction: "neutral", label: rangeLabel }} />
            <StatCard label={outLabel} value={register ? money(register.totalOut) : "—"} trend={{ direction: "neutral", label: rangeLabel }} />
            <StatCard label="Unreconciled" value={register ? String(register.rows.filter((r) => !r.reconciled).length) : "—"} trend={{ direction: "neutral", label: "entries in this range" }} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <DatePicker value={from} onChange={setFrom} placeholder="From" />
            </div>
            <div className="w-40">
              <DatePicker value={to} onChange={setTo} placeholder="To" />
            </div>
            <Select value={unreconciledOnly ? "unreconciled" : "all"} onValueChange={(v) => setUnreconciledOnly(v === "unreconciled")}>
              <SelectTrigger className="w-44" aria-label="Which entries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entries</SelectItem>
                <SelectItem value="unreconciled">Unreconciled only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!register ? (
            <TableSkeleton columns={TABLE_COLUMNS} />
          ) : !register.hasEntries ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState icon={<Landmark />} title="Nothing has gone in or out of this account yet." description="Payments, expenses and transfers on this account appear here." />
            </div>
          ) : (
            <div data-testid="register-table" className="flex flex-col gap-3">
              {/* Newest first; each row's balance is the running balance after it. */}
              <DataTable
                columns={columns}
                data={[...register.rows].reverse()}
                rowKey={(row) => row.journalLineId}
                searchPlaceholder="Search entries"
                searchKey={(row) => `${row.what} ${row.contact?.name ?? ""} ${row.reference ?? ""}`}
                configurablePageSize
              />
              <p className="text-[13px] text-on-surface-muted">
                {isCard ? "Owed" : "Opening balance"} on {formatDay(register.from ?? toIsoDate(from))}: <span className="font-semibold text-on-surface">{money(register.openingBalance)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

