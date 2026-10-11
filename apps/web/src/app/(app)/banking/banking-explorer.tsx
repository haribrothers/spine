"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, MoreHorizontal } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { MONEY_ACCOUNT_KIND_LABELS, type BankTransaction, type BankTransactionDirection, type BankTransfer, type MoneyAccount } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { formatDay } from "./dates";
import { useToast } from "../../../components/toast-host";
import { MoneyAccountDialog } from "./money-account-dialog";
import { MoneyInOutDialog } from "./money-in-out-dialog";
import { TransferDialog } from "./transfer-dialog";

const TABLE_COLUMNS = [
  { key: "name", header: "Account", width: "w-48" },
  { key: "kind", header: "Type", width: "w-24" },
  { key: "bank", header: "Bank", width: "w-40" },
  { key: "balance", header: "Balance in Spine", width: "w-28" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "First Coastal Bank · ••0193"; cash shows nothing. */
function bankLine(account: MoneyAccount): string {
  return [account.bankName, account.last4 ? `••${account.last4}` : null].filter(Boolean).join(" · ");
}

/**
 * US-BANK-01 — `BankingAccounts`: every bank, cash and card account with
 * its balance in Spine. Owners add and edit accounts.
 */
export function BankingExplorer() {
  const isOwner = useMyRole() === "owner";
  const canRecord = useCapability("banking.record");
  const [transferOpen, setTransferOpen] = useState(false);
  const [moneyDirection, setMoneyDirection] = useState<BankTransactionDirection | null>(null);
  // Every account, archived included; `rows` below is the active ones, which pickers and totals use.
  const [allRows, setAllRows] = useState<MoneyAccount[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const rows = useMemo(() => allRows?.filter((r) => !r.archivedAt) ?? null, [allRows]);
  const archivedRows = useMemo(() => allRows?.filter((r) => r.archivedAt) ?? null, [allRows]);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);
  const showToast = useToast();

  const load = useCallback(() => {
    apiClient
      .get<MoneyAccount[]>("/money-accounts?includeArchived=true")
      .then(setAllRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your accounts. Refresh to try again."));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? "USD"))
      .catch(() => {});
  }, [load]);

  const totals = useMemo(() => {
    if (!rows) return null;
    const cash = rows.filter((r) => r.kind !== "card");
    const cards = rows.filter((r) => r.kind === "card");
    return {
      cash: cash.reduce((sum, r) => sum + BigInt(r.balance ?? "0"), 0n),
      cashCount: cash.length,
      owed: cards.reduce((sum, r) => sum + BigInt(r.balance ?? "0"), 0n),
      cardCount: cards.length,
      unreconciled: rows.reduce((sum, r) => sum + (r.unreconciledCount ?? 0), 0),
      unreconciledAccounts: rows.filter((r) => (r.unreconciledCount ?? 0) > 0).length,
      lastReconciled: rows.filter((r) => r.lastReconciledOn).sort((a, b) => b.lastReconciledOn!.localeCompare(a.lastReconciledOn!))[0] ?? null,
    };
  }, [rows]);

  function handleTransferred(transfer: BankTransfer) {
    load();
    showToast(`Moved ${formatMoney(BigInt(transfer.amount), currency)} from ${transfer.fromMoneyAccount.name} to ${transfer.toMoneyAccount.name}`, "Both registers show the transfer.");
  }

  function handleMoneyRecorded(entry: BankTransaction) {
    load();
    showToast(
      `${entry.direction === "in" ? "Money in" : "Money out"} recorded`,
      `${formatMoney(BigInt(entry.amount), currency)} ${entry.direction === "in" ? "into" : "from"} ${entry.moneyAccount.name} — ${entry.account.name}.`,
    );
  }

  async function setArchived(account: MoneyAccount, archive: boolean) {
    try {
      await apiClient.post(`/money-accounts/${account.id}/${archive ? "archive" : "restore"}`);
      load();
      showToast(archive ? "Account archived" : "Account restored", archive ? `${account.name} is under Archived accounts. Its history stays.` : `${account.name} is back in the pickers.`);
    } catch (err) {
      showToast(archive ? `Couldn't archive ${account.name}` : `Couldn't restore ${account.name}`, err instanceof Error ? err.message : "Try again.");
    }
  }

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleSaved(saved: MoneyAccount, created: boolean) {
    load();
    showToast(created ? "Account added" : "Account saved", created ? `${saved.name} is ready to use on payments and expenses.` : `${saved.name} has been updated.`);
  }

  const columns: TableColumn<MoneyAccount>[] = [
    {
      key: "name",
      header: "Account",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/banking/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
            {row.name}
          </Link>
          {row.isDefault && <Badge className="bg-primary/10 text-primary">Default</Badge>}
        </span>
      ),
      sortValue: (row) => row.name.toLowerCase(),
    },
    { key: "kind", header: "Type", render: (row) => MONEY_ACCOUNT_KIND_LABELS[row.kind] },
    { key: "bank", header: "Bank", render: (row) => bankLine(row) || <span className="text-on-surface-muted">—</span> },
    {
      key: "balance",
      header: "Balance in Spine",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(BigInt(row.balance ?? "0"), currency)}
          {row.kind === "card" && " owed"}
        </span>
      ),
      sortValue: (row) => Number(row.balance ?? "0"),
    },
    {
      key: "reconciliation",
      header: "Reconciliation",
      render: (row) =>
        row.lastReconciledOn ? (
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status="paid">Reconciled</StatusChip>
            <span className="text-[13px] text-on-surface-muted">{formatDay(row.lastReconciledOn)}</span>
          </span>
        ) : (
          <StatusChip status="draft">Never reconciled</StatusChip>
        ),
    },
    {
      key: "unreconciled",
      header: "Unreconciled",
      align: "right",
      render: (row) => <span className="tabular-nums">{plural(row.unreconciledCount ?? 0, "entry", "entries")}</span>,
      sortValue: (row) => row.unreconciledCount ?? 0,
    },
    ...(isOwner
      ? [
          {
            key: "actions",
            header: "Actions",
            align: "right" as const,
            render: (row: MoneyAccount) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(row);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  {row.archivedAt ? (
                    <DropdownMenuItem onSelect={() => setArchived(row, false)}>Restore</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setArchived(row, true)}>Archive</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : []),
  ];

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bank and cash"
          value={totals ? formatMoney(totals.cash, currency) : "—"}
          trend={totals ? { direction: "neutral", label: plural(totals.cashCount, "account", "accounts") } : undefined}
        />
        <StatCard
          label="Owed on cards"
          value={totals ? formatMoney(totals.owed, currency) : "—"}
          trend={totals ? { direction: "neutral", label: plural(totals.cardCount, "card", "cards") } : undefined}
        />
        <StatCard
          label="Not yet reconciled"
          value={totals ? String(totals.unreconciled) : "—"}
          trend={totals ? { direction: "neutral", label: `entries across ${plural(totals.unreconciledAccounts, "account", "accounts")}` } : undefined}
        />
        <StatCard
          label="Last reconciled"
          value={totals?.lastReconciled?.lastReconciledOn ? formatDay(totals.lastReconciled.lastReconciledOn) : "Never"}
          trend={totals?.lastReconciled ? { direction: "neutral", label: totals.lastReconciled.name } : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={showArchived ? "archived" : "active"} onValueChange={(v) => setShowArchived(v === "archived")}>
          <SelectTrigger className="w-48" aria-label="Which accounts">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active accounts</SelectItem>
            <SelectItem value="archived">Archived accounts</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canRecord && (
            <Button variant="secondary" onClick={() => setTransferOpen(true)} disabled={!rows || rows.length < 2}>
              Transfer
            </Button>
          )}
          {canRecord && (
            <Button variant="secondary" onClick={() => setMoneyDirection("in")} disabled={!rows?.length}>
              Money in
            </Button>
          )}
          {canRecord && (
            <Button variant="secondary" onClick={() => setMoneyDirection("out")} disabled={!rows?.length}>
              Money out
            </Button>
          )}
          {isOwner && <Button onClick={openAdd}>Add account</Button>}
        </div>
      </div>

      {!rows ? (
        <TableSkeleton columns={TABLE_COLUMNS} />
      ) : showArchived && archivedRows?.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Landmark />} title="No archived accounts" description="Accounts you archive appear here with their history, and can be restored." />
        </div>
      ) : (
        <div data-testid="money-accounts-table">
          <DataTable
            columns={columns}
            data={(showArchived ? archivedRows : rows) ?? []}
            rowKey={(row) => row.id}
            searchPlaceholder="Search accounts"
            searchKey={(row) => `${row.name} ${row.bankName ?? ""} ${row.last4 ?? ""}`}
            configurablePageSize
          />
        </div>
      )}

      <MoneyInOutDialog
        direction={moneyDirection ?? "in"}
        open={moneyDirection !== null}
        onOpenChange={(open) => !open && setMoneyDirection(null)}
        accounts={rows ?? []}
        currency={currency}
        onRecorded={handleMoneyRecorded}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} accounts={rows ?? []} currency={currency} onRecorded={handleTransferred} />
      <MoneyAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editing} onSaved={handleSaved} />
    </div>
  );
}
