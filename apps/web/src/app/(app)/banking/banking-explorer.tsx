"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Landmark, ListFilter, MoreHorizontal, RefreshCw, Search, Wallet } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  TableSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  useConfirm,
  type TableColumn,
} from "@spine/ui";
import { MONEY_ACCOUNT_KIND_LABELS, type BankTransaction, type BankTransactionDirection, type BankTransfer, type MoneyAccount, type MoneyAccountKind } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { replaceQuery } from "../../../lib/replace-query";
import { useToast } from "../../../components/toast-host";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { formatDay } from "./dates";
import { MoneyAccountDialog } from "./money-account-dialog";
import { MoneyInOutDialog } from "./money-in-out-dialog";
import { TransferDialog } from "./transfer-dialog";
import { StatementImportDialog } from "./statement-import-dialog";
import { bankLine, bankingQuery, bankingTotals, filterAccounts, parseBankingState, type BankingListState, type BankingTab } from "./banking-list-state";

const TABLE_COLUMNS = [
  { key: "name", header: "Account", width: "w-48" },
  { key: "kind", header: "Type", width: "w-24" },
  { key: "balance", header: "Balance in Spine", width: "w-28" },
  { key: "reconciliation", header: "Reconciliation", width: "w-32" },
];

const ALL_TYPES = "__all__";
const KIND_ICON: Record<MoneyAccountKind, typeof Landmark> = { bank: Landmark, cash: Wallet, card: CreditCard };

type Recording = { kind: "in" | "out" | "transfer"; accountId?: string } | null;

/**
 * US-BANK-01, US-BANK-13 (D-210, D-231) — `BankingAccounts`: every bank,
 * cash and card account on the list layout every refined list shares —
 * tabs (Active, Archived), the cards (Not yet reconciled filters), the
 * filter bar (Type; Updated, Refresh, Transfer, Money in, Money out, Add
 * account) and the search bar, all kept in the address. Each row's menu
 * acts on that account, with its right.
 */
export function BankingExplorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOwner = useMyRole() === "owner";
  const canRecord = useCapability("banking.record");
  const [state, setState] = useState<BankingListState>(() => parseBankingState(new URLSearchParams(searchParams.toString())));
  const [allRows, setAllRows] = useState<MoneyAccount[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);
  const [recording, setRecording] = useState<Recording>(null);
  const [importing, setImporting] = useState<MoneyAccount | null>(null);
  const loading = useRef(false);
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  function update(patch: Partial<BankingListState>) {
    const next = { ...state, ...patch };
    setState(next);
    replaceQuery(pathname, bankingQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh" = "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setAllRows(await apiClient.get<MoneyAccount[]>("/money-accounts?includeArchived=true"));
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Couldn't load your accounts. Refresh to try again.");
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? "USD"))
      .catch(() => {});
  }, [load]);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = useMemo(() => allRows?.filter((r) => !r.archivedAt) ?? [], [allRows]);
  const totals = useMemo(() => (allRows ? bankingTotals(allRows) : null), [allRows]);
  const rows = useMemo(() => (allRows ? filterAccounts(allRows, state) : null), [allRows, state]);
  const archivedCount = allRows ? allRows.length - active.length : 0;

  function handleTransferred(transfer: BankTransfer) {
    void load();
    showToast(`Moved ${formatMoney(BigInt(transfer.amount), currency)} from ${transfer.fromMoneyAccount.name} to ${transfer.toMoneyAccount.name}`, "Both registers show the transfer.");
  }

  function handleMoneyRecorded(entry: BankTransaction) {
    void load();
    showToast(
      `${entry.direction === "in" ? "Money in" : "Money out"} recorded`,
      `${formatMoney(BigInt(entry.amount), currency)} ${entry.direction === "in" ? "into" : "from"} ${entry.moneyAccount.name} — ${entry.account.name}.`,
    );
  }

  async function archive(account: MoneyAccount) {
    if (account.isDefault) {
      showToast(`Couldn't archive ${account.name}`, "Choose another default account first.");
      return;
    }
    const ok = await confirm({
      title: `Archive ${account.name}?`,
      description: "It leaves the account pickers on payments, expenses and transfers. Its register, reconciliations and ledger history stay, and you can restore it from Archived.",
      confirmLabel: "Archive account",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    try {
      await apiClient.post(`/money-accounts/${account.id}/archive`);
      void load();
      showToast("Account archived", `${account.name} is under Archived. Its history stays.`);
    } catch (err) {
      showToast(`Couldn't archive ${account.name}`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function restore(account: MoneyAccount) {
    try {
      await apiClient.post(`/money-accounts/${account.id}/restore`);
      void load();
      showToast("Account restored", `${account.name} is back in the pickers.`);
    } catch (err) {
      showToast(`Couldn't restore ${account.name}`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function makeDefault(account: MoneyAccount) {
    const previous = active.find((a) => a.isDefault);
    try {
      await apiClient.put(`/money-accounts/${account.id}`, { kind: account.kind, name: account.name, bankName: account.bankName, last4: account.last4, isDefault: true });
      void load();
      showToast(`${account.name} is the default`, previous ? `New payments use it instead of ${previous.name}.` : "New payments use it.");
    } catch (err) {
      showToast(`Couldn't make ${account.name} the default`, err instanceof Error ? err.message : "Try again.");
    }
  }

  function handleSaved(saved: MoneyAccount, created: boolean) {
    void load();
    showToast(created ? "Account added" : "Account saved", created ? `${saved.name} is ready to use on payments and expenses.` : `${saved.name} has been updated.`);
  }

  const columns: TableColumn<MoneyAccount>[] = [
    {
      key: "name",
      header: "Account",
      render: (row) => {
        const Icon = KIND_ICON[row.kind];
        const line = bankLine(row);
        return (
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-on-surface-muted">
              <Icon size={17} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/banking/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
                  {row.name}
                </Link>
                {row.isDefault && <Badge className="bg-primary/10 text-primary">Default</Badge>}
              </span>
              {line && <span className="text-[12.5px] text-on-surface-muted">{line}</span>}
            </span>
          </span>
        );
      },
      sortValue: (row) => row.name.toLowerCase(),
    },
    { key: "kind", header: "Type", render: (row) => MONEY_ACCOUNT_KIND_LABELS[row.kind], sortValue: (row) => row.kind },
    {
      key: "balance",
      header: "Balance in Spine",
      align: "right",
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatMoney(BigInt(row.balance ?? "0"), currency)}
          {row.kind === "card" && <span className="text-[12.5px] text-on-surface-muted"> owed</span>}
        </span>
      ),
      sortValue: (row) => BigInt(row.balance ?? "0"),
    },
    {
      key: "reconciliation",
      header: "Reconciliation",
      render: (row) => (row.lastReconciledOn ? <span>Reconciled to {formatDay(row.lastReconciledOn)}</span> : <span className="text-on-surface-muted">Never reconciled</span>),
      sortValue: (row) => row.lastReconciledOn ?? "",
    },
    {
      key: "unreconciled",
      header: "Unreconciled",
      render: (row) =>
        (row.unreconciledCount ?? 0) > 0 ? (
          <Link href={`/banking/${row.id}?show=unreconciled`} className="font-medium text-primary hover:underline">
            {row.unreconciledCount} unreconciled
          </Link>
        ) : (
          <span className="text-on-surface-muted">None</span>
        ),
      sortValue: (row) => row.unreconciledCount ?? 0,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <AccountRowMenu
            account={row}
            isOwner={isOwner}
            canRecord={canRecord}
            canRecordTransfer={active.length > 1}
            onRecord={(kind) => setRecording({ kind, accountId: row.id })}
            onImport={() => setImporting(row)}
            onEdit={() => {
              setEditing(row);
              setDialogOpen(true);
            }}
            onMakeDefault={() => void makeDefault(row)}
            onArchive={() => void archive(row)}
            onRestore={() => void restore(row)}
          />
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder="Search accounts" aria-label="Search accounts" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={state.tab} onValueChange={(tab) => update({ tab: tab as BankingTab })} className="flex flex-col gap-6">
        <TabsList data-print="hide">
          <TabsTrigger value="active" className="group" aria-label={allRows ? `Active, ${active.length}` : "Active"}>
            Active
            {allRows && <Count n={active.length} />}
          </TabsTrigger>
          <TabsTrigger value="archived" className="group" aria-label={allRows ? `Archived, ${archivedCount}` : "Archived"}>
            Archived
            {allRows && <Count n={archivedCount} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={state.tab} className="flex flex-col gap-6 pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="banking-cards">
            <StatCard label="Bank and cash" value={totals ? formatMoney(totals.cash, currency) : "—"} trend={totals ? { direction: "neutral", label: totals.cashLabel } : undefined} className="h-full" />
            <StatCard label="Owed on cards" value={totals ? formatMoney(totals.owed, currency) : "—"} trend={totals ? { direction: "neutral", label: totals.cardLabel } : undefined} className="h-full" />
            <button
              type="button"
              aria-pressed={state.unreconciled}
              aria-label="Show accounts not yet reconciled only"
              onClick={() => update({ unreconciled: !state.unreconciled })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label="Not yet reconciled"
                value={totals ? String(totals.unreconciled) : "—"}
                tone={totals && totals.unreconciled > 0 ? "warning" : "default"}
                trend={{ direction: "neutral", label: state.unreconciled ? "Showing these · press again to clear" : (totals?.unreconciledLabel ?? "") }}
                className={cn("h-full transition-colors hover:border-border-strong", state.unreconciled && "border-primary bg-info-bg/60 ring-1 ring-primary")}
              />
              <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", state.unreconciled ? "text-primary" : "text-on-surface-muted")} />
            </button>
            <StatCard
              label="Last reconciled"
              value={totals?.lastReconciled?.lastReconciledOn ? formatDay(totals.lastReconciled.lastReconciledOn) : "Never"}
              trend={totals?.lastReconciled ? { direction: "neutral", label: totals.lastReconciled.name } : undefined}
              className="h-full"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
            <Select value={state.type ?? ALL_TYPES} onValueChange={(v) => update({ type: v === ALL_TYPES ? null : (v as MoneyAccountKind) })}>
              <SelectTrigger aria-label="Filter by type" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {updatedAt !== null && (
                <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="banking-updated">
                  {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing} onClick={() => void load()}>
                    <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh list</TooltipContent>
              </Tooltip>
              {canRecord && (
                <>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "transfer" })} disabled={active.length < 2}>
                    <MENU_ICONS.transfer size={14} aria-hidden />
                    Transfer
                  </Button>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "in" })} disabled={!active.length}>
                    <MENU_ICONS.moneyIn size={14} aria-hidden />
                    Money in
                  </Button>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "out" })} disabled={!active.length}>
                    <MENU_ICONS.moneyOut size={14} aria-hidden />
                    Money out
                  </Button>
                </>
              )}
              {isOwner && (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  Add account
                </Button>
              )}
            </div>
          </div>

          {!rows ? (
            <TableSkeleton columns={TABLE_COLUMNS} />
          ) : rows.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex">{search}</div>
              <div className="rounded-lg border border-border bg-surface">
                {state.tab === "archived" && !state.q.trim() && !state.type ? (
                  <EmptyState icon={<Landmark />} title="No archived accounts" description="Accounts you archive appear here with their history, and can be restored." />
                ) : (
                  <EmptyState
                    icon={<Landmark />}
                    title="No accounts match"
                    description="Clear the filters to see every account."
                    action={
                      <Button variant="secondary" onClick={() => update({ type: null, unreconciled: false, q: "" })}>
                        Clear filters
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div data-testid="money-accounts-table">
              <DataTable columns={columns} data={rows} rowKey={(row) => row.id} toolbarStart={search} configurablePageSize />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MoneyInOutDialog
        direction={(recording?.kind === "out" ? "out" : "in") as BankTransactionDirection}
        open={recording?.kind === "in" || recording?.kind === "out"}
        onOpenChange={(open) => !open && setRecording(null)}
        accounts={active}
        currency={currency}
        initialAccountId={recording?.accountId}
        onRecorded={handleMoneyRecorded}
      />
      <TransferDialog
        open={recording?.kind === "transfer"}
        onOpenChange={(open) => !open && setRecording(null)}
        accounts={active}
        currency={currency}
        initialAccountId={recording?.accountId}
        onRecorded={handleTransferred}
      />
      <MoneyAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editing} onSaved={handleSaved} />
      {importing && (
        <StatementImportDialog
          open
          onOpenChange={(open) => !open && setImporting(null)}
          accountId={importing.id}
          accountName={importing.name}
          onImported={() => {
            setImporting(null);
            void load();
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/** US-BANK-13 — a row's menu: each action with its icon (D-222) and only with the right to do it. */
function AccountRowMenu({
  account,
  isOwner,
  canRecord,
  canRecordTransfer,
  onRecord,
  onImport,
  onEdit,
  onMakeDefault,
  onArchive,
  onRestore,
}: {
  account: MoneyAccount;
  isOwner: boolean;
  canRecord: boolean;
  canRecordTransfer: boolean;
  onRecord: (kind: "in" | "out" | "transfer") => void;
  onImport: () => void;
  onEdit: () => void;
  onMakeDefault: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const router = useRouter();
  const canReconcile = useCapability("banking.reconcile");
  const archived = Boolean(account.archivedAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${account.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => router.push(`/banking/${account.id}`)}>
          <MENU_ICONS.register aria-hidden />
          Open register
        </DropdownMenuItem>
        {!archived && canReconcile && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push(`/banking/${account.id}/reconcile`)}>
              <MENU_ICONS.reconcile aria-hidden />
              Reconcile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onImport}>
              <MENU_ICONS.importStatement aria-hidden />
              Import statement
            </DropdownMenuItem>
          </>
        )}
        {!archived && canRecord && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRecord("in")}>
              <MENU_ICONS.moneyIn aria-hidden />
              Money in
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRecord("out")}>
              <MENU_ICONS.moneyOut aria-hidden />
              Money out
            </DropdownMenuItem>
            {canRecordTransfer && (
              <DropdownMenuItem onSelect={() => onRecord("transfer")}>
                <MENU_ICONS.transfer aria-hidden />
                Transfer
              </DropdownMenuItem>
            )}
          </>
        )}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            {!archived && !account.isDefault && (
              <DropdownMenuItem onSelect={onMakeDefault}>
                <MENU_ICONS.setDefault aria-hidden />
                Set as default
              </DropdownMenuItem>
            )}
            {!archived && (
              <DropdownMenuItem onSelect={onEdit}>
                <MENU_ICONS.edit aria-hidden />
                Edit
              </DropdownMenuItem>
            )}
            {archived ? (
              <DropdownMenuItem onSelect={onRestore}>
                <MENU_ICONS.restore aria-hidden />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onArchive}>
                <MENU_ICONS.archive aria-hidden />
                Archive
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">
      {n}
    </span>
  );
}
