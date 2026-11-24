"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Landmark, ListFilter, MoreHorizontal, Plus, RefreshCw, Search, Wallet } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ChipStrip,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  FilterSheet,
  FloatingActionButton,
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
  type FilterChip,
  type TableColumn,
} from "@spine/ui";
import { MONEY_ACCOUNT_KIND_LABELS, type BankTransaction, type BankTransactionDirection, type BankTransfer, type MoneyAccount, type MoneyAccountKind } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t, useT } from "../../../lib/i18n";
import { PhoneMoreActions } from "../../../lib/phone-bar";
import { useIsPhone } from "../../../lib/use-is-phone";
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
  { key: "name", header: t("banking.explorer.colAccount"), width: "w-48" },
  { key: "kind", header: t("banking.explorer.colType"), width: "w-24" },
  { key: "balance", header: t("banking.explorer.colBalance"), width: "w-28" },
  { key: "reconciliation", header: t("banking.explorer.colReconciliation"), width: "w-32" },
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
  const t = useT();
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
  const isPhone = useIsPhone();
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
      if (mode === "first") setError(err instanceof Error ? err.message : t("banking.explorer.loadError"));
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
    showToast(
      t("banking.explorer.transferToastTitle", { amount: formatMoney(BigInt(transfer.amount), currency), from: transfer.fromMoneyAccount.name, to: transfer.toMoneyAccount.name }),
      t("banking.explorer.transferToastBody"),
    );
  }

  function handleMoneyRecorded(entry: BankTransaction) {
    void load();
    showToast(
      entry.direction === "in" ? t("banking.explorer.moneyInRecorded") : t("banking.explorer.moneyOutRecorded"),
      t(entry.direction === "in" ? "banking.explorer.moneyInBody" : "banking.explorer.moneyOutBody", { amount: formatMoney(BigInt(entry.amount), currency), account: entry.moneyAccount.name, category: entry.account.name }),
    );
  }

  async function archive(account: MoneyAccount) {
    if (account.isDefault) {
      showToast(t("banking.explorer.archiveFailed", { name: account.name }), t("banking.explorer.archiveDefaultBody"));
      return;
    }
    const ok = await confirm({
      title: t("banking.explorer.archiveConfirmTitle", { name: account.name }),
      description: t("banking.explorer.archiveConfirmBody"),
      confirmLabel: t("banking.explorer.archiveConfirmLabel"),
      cancelLabel: t("banking.explorer.goBack"),
    });
    if (!ok) return;
    try {
      await apiClient.post(`/money-accounts/${account.id}/archive`);
      void load();
      showToast(t("banking.explorer.archivedTitle"), t("banking.explorer.archivedBody", { name: account.name }));
    } catch (err) {
      showToast(t("banking.explorer.archiveFailed", { name: account.name }), err instanceof Error ? err.message : t("banking.explorer.tryAgain"));
    }
  }

  async function restore(account: MoneyAccount) {
    try {
      await apiClient.post(`/money-accounts/${account.id}/restore`);
      void load();
      showToast(t("banking.explorer.restoredTitle"), t("banking.explorer.restoredBody", { name: account.name }));
    } catch (err) {
      showToast(t("banking.explorer.restoreFailed", { name: account.name }), err instanceof Error ? err.message : t("banking.explorer.tryAgain"));
    }
  }

  async function makeDefault(account: MoneyAccount) {
    const previous = active.find((a) => a.isDefault);
    try {
      await apiClient.put(`/money-accounts/${account.id}`, { kind: account.kind, name: account.name, bankName: account.bankName, last4: account.last4, isDefault: true });
      void load();
      showToast(
        t("banking.explorer.defaultTitle", { name: account.name }),
        previous ? t("banking.explorer.defaultBodyInstead", { previous: previous.name }) : t("banking.explorer.defaultBody"),
      );
    } catch (err) {
      showToast(t("banking.explorer.defaultFailed", { name: account.name }), err instanceof Error ? err.message : t("banking.explorer.tryAgain"));
    }
  }

  function handleSaved(saved: MoneyAccount, created: boolean) {
    void load();
    showToast(
      created ? t("banking.explorer.addedTitle") : t("banking.explorer.savedTitle"),
      created ? t("banking.explorer.addedBody", { name: saved.name }) : t("banking.explorer.savedBody", { name: saved.name }),
    );
  }

  const columns: TableColumn<MoneyAccount>[] = [
    {
      key: "name",
      header: t("banking.explorer.colAccount"),
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
                {row.isDefault && <Badge className="bg-primary/10 text-primary">{t("banking.explorer.defaultBadge")}</Badge>}
              </span>
              {line && <span className="text-[12.5px] text-on-surface-muted">{line}</span>}
            </span>
          </span>
        );
      },
      // US-OPS-56: on a phone, the name alone; Default is its badge and the bank goes on the second line.
      phone: "title",
      phoneRender: (row) => <Link href={`/banking/${row.id}`}>{row.name}</Link>,
      sortValue: (row) => row.name.toLowerCase(),
    },
    {
      key: "kind",
      phone: "subtitle",
      phoneRender: (row) => [MONEY_ACCOUNT_KIND_LABELS[row.kind], bankLine(row)].filter(Boolean).join(" · "),
      header: t("banking.explorer.colType"),
      render: (row) => MONEY_ACCOUNT_KIND_LABELS[row.kind],
      sortValue: (row) => row.kind,
    },
    {
      key: "balance",
      phone: "trailing",
      header: t("banking.explorer.colBalance"),
      align: "right",
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatMoney(BigInt(row.balance ?? "0"), currency)}
          {row.kind === "card" && <span className="text-[12.5px] text-on-surface-muted">{t("banking.explorer.owedSuffix")}</span>}
        </span>
      ),
      sortValue: (row) => BigInt(row.balance ?? "0"),
    },
    {
      key: "reconciliation",
      // On a phone, the Default badge sits in this slot; reconciliation is said under the balance.
      phone: "badge",
      phoneRender: (row) => (row.isDefault ? <Badge className="bg-primary/10 text-primary">{t("banking.explorer.defaultBadge")}</Badge> : null),
      header: t("banking.explorer.colReconciliation"),
      render: (row) =>
        row.lastReconciledOn ? (
          <span>{t("banking.explorer.reconciledTo", { date: formatDay(row.lastReconciledOn) })}</span>
        ) : (
          <span className="text-on-surface-muted">{t("banking.explorer.neverReconciled")}</span>
        ),
      sortValue: (row) => row.lastReconciledOn ?? "",
    },
    {
      key: "unreconciled",
      // Under the balance on a phone: how many lines are left to reconcile, else when it was last reconciled.
      phone: "trailingSub",
      phoneRender: (row) =>
        (row.unreconciledCount ?? 0) > 0 ? (
          <span className="text-due-soon">{t("banking.explorer.unreconciledCount", { n: row.unreconciledCount ?? 0 })}</span>
        ) : row.lastReconciledOn ? (
          t("banking.explorer.reconciledTo", { date: formatDay(row.lastReconciledOn) })
        ) : (
          t("banking.explorer.neverReconciled")
        ),
      header: t("banking.explorer.colUnreconciled"),
      render: (row) =>
        (row.unreconciledCount ?? 0) > 0 ? (
          <Link href={`/banking/${row.id}?show=unreconciled`} className="font-medium text-primary hover:underline">
            {t("banking.explorer.unreconciledCount", { n: row.unreconciledCount ?? 0 })}
          </Link>
        ) : (
          <span className="text-on-surface-muted">{t("banking.explorer.none")}</span>
        ),
      sortValue: (row) => row.unreconciledCount ?? 0,
    },
    {
      key: "actions",
      phone: "action",
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
      <Input type="search" placeholder={t("banking.explorer.searchPlaceholder")} aria-label={t("banking.explorer.searchPlaceholder")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const clearAll = () => update({ type: null, unreconciled: false, q: "" });
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const typeNames: Record<string, string> = { bank: t("banking.explorer.typeBank"), cash: t("banking.explorer.typeCash"), card: t("banking.explorer.typeCard") };
  const filterChips: FilterChip[] = [
    ...(state.type ? [{ key: "type", label: typeNames[state.type] ?? state.type, onRemove: () => update({ type: null }) }] : []),
    ...(state.unreconciled ? [{ key: "unreconciled", label: t("banking.explorer.cardUnreconciled"), onRemove: () => update({ unreconciled: false }) }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={state.tab} onValueChange={(tab) => update({ tab: tab as BankingTab })} className="flex flex-col gap-6">
        <TabsList data-print="hide">
          <TabsTrigger value="active" className="group" aria-label={allRows ? t("banking.explorer.tabActiveCount", { n: active.length }) : t("banking.explorer.tabActive")}>
            {t("banking.explorer.tabActive")}
            {allRows && <Count n={active.length} />}
          </TabsTrigger>
          <TabsTrigger value="archived" className="group" aria-label={allRows ? t("banking.explorer.tabArchivedCount", { n: archivedCount }) : t("banking.explorer.tabArchived")}>
            {t("banking.explorer.tabArchived")}
            {allRows && <Count n={archivedCount} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={state.tab} className="flex flex-col gap-6 pt-0">
          {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
          <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="banking-cards">
            <StatCard label={t("banking.explorer.cardBankCash")} value={totals ? formatMoney(totals.cash, currency) : "—"} trend={totals ? { direction: "neutral", label: totals.cashLabel } : undefined} className="h-full" />
            <StatCard label={t("banking.explorer.cardOwed")} value={totals ? formatMoney(totals.owed, currency) : "—"} trend={totals ? { direction: "neutral", label: totals.cardLabel } : undefined} className="h-full" />
            <button
              type="button"
              aria-pressed={state.unreconciled}
              aria-label={t("banking.explorer.cardUnreconciledAria")}
              onClick={() => update({ unreconciled: !state.unreconciled })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label={t("banking.explorer.cardUnreconciled")}
                value={totals ? String(totals.unreconciled) : "—"}
                tone={totals && totals.unreconciled > 0 ? "warning" : "default"}
                trend={{ direction: "neutral", label: state.unreconciled ? t("banking.explorer.cardShowing") : (totals?.unreconciledLabel ?? "") }}
                className={cn("h-full transition-colors hover:border-border-strong", state.unreconciled && "border-primary bg-info-bg/60 ring-1 ring-primary")}
              />
              <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4 max-md:hidden", state.unreconciled ? "text-primary" : "text-on-surface-muted")} />
            </button>
            <StatCard
              label={t("banking.explorer.cardLastReconciled")}
              value={totals?.lastReconciled?.lastReconciledOn ? formatDay(totals.lastReconciled.lastReconciledOn) : t("banking.explorer.never")}
              trend={totals?.lastReconciled ? { direction: "neutral", label: totals.lastReconciled.name } : undefined}
              className="h-full"
            />
          </ChipStrip>

          <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
            {/* US-OPS-57: on a phone, search and Filters in one row, the type in a sheet. */}
            <FilterSheet
              className="contents"
              search={isPhone ? search : undefined}
              chips={filterChips}
              onClearAll={clearAll}
              showLabel={rows ? t("banking.explorer.showCount", { count: rows.length }) : undefined}
            >
              <Select value={state.type ?? ALL_TYPES} onValueChange={(v) => update({ type: v === ALL_TYPES ? null : (v as MoneyAccountKind) })}>
                <SelectTrigger aria-label={t("banking.explorer.filterType")} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>{t("banking.explorer.allTypes")}</SelectItem>
                  <SelectItem value="bank">{t("banking.explorer.typeBank")}</SelectItem>
                  <SelectItem value="cash">{t("banking.explorer.typeCash")}</SelectItem>
                  <SelectItem value="card">{t("banking.explorer.typeCard")}</SelectItem>
                </SelectContent>
              </Select>
            </FilterSheet>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {updatedAt !== null && (
                <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="banking-updated">
                  {refreshing ? t("banking.explorer.updating") : updatedLabel(updatedAt, now)}
                </span>
              )}
              <PhoneMoreActions>
              {isPhone ? (
                <Button variant="secondary" aria-busy={refreshing} disabled={refreshing} onClick={() => void load()}>
                  <RefreshCw size={16} aria-hidden />
                  {t("banking.explorer.refreshList")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label={t("banking.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing} onClick={() => void load()}>
                      <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("banking.explorer.refreshList")}</TooltipContent>
                </Tooltip>
              )}
              {canRecord && (
                <>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "transfer" })} disabled={active.length < 2}>
                    <MENU_ICONS.transfer size={14} aria-hidden />
                    {t("banking.explorer.transfer")}
                  </Button>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "in" })} disabled={!active.length}>
                    <MENU_ICONS.moneyIn size={14} aria-hidden />
                    {t("banking.explorer.moneyIn")}
                  </Button>
                  <Button variant="secondary" onClick={() => setRecording({ kind: "out" })} disabled={!active.length}>
                    <MENU_ICONS.moneyOut size={14} aria-hidden />
                    {t("banking.explorer.moneyOut")}
                  </Button>
                </>
              )}
              </PhoneMoreActions>
              {isOwner && (
                <FloatingActionButton>
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    {/* The floating button shrinks to its icon while the page scrolls; the desktop button has none. */}
                    {isPhone && <Plus size={14} aria-hidden />}
                    {t("banking.explorer.addAccount")}
                  </Button>
                </FloatingActionButton>
              )}
            </div>
          </div>

          {!rows ? (
            <TableSkeleton columns={TABLE_COLUMNS} />
          ) : rows.length === 0 ? (
            <div className="flex flex-col gap-3">
              {!isPhone && <div className="flex">{search}</div>}
              <div className="rounded-lg border border-border bg-surface">
                {state.tab === "archived" && !state.q.trim() && !state.type ? (
                  <EmptyState icon={<Landmark />} title={t("banking.explorer.emptyArchivedTitle")} description={t("banking.explorer.emptyArchivedBody")} />
                ) : (
                  <EmptyState
                    icon={<Landmark />}
                    title={t("banking.explorer.emptyNoMatchTitle")}
                    description={t("banking.explorer.emptyNoMatchBody")}
                    action={
                      <Button variant="secondary" onClick={clearAll}>
                        {t("banking.explorer.clearFilters")}
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div data-testid="money-accounts-table">
              <DataTable columns={columns} data={rows} rowKey={(row) => row.id} toolbarStart={isPhone ? <span /> : search} configurablePageSize />
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
  const t = useT();
  const router = useRouter();
  const canReconcile = useCapability("banking.reconcile");
  const archived = Boolean(account.archivedAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("banking.explorer.actionsFor", { name: account.name })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => router.push(`/banking/${account.id}`)}>
          <MENU_ICONS.register aria-hidden />
          {t("banking.explorer.openRegister")}
        </DropdownMenuItem>
        {!archived && canReconcile && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push(`/banking/${account.id}/reconcile`)}>
              <MENU_ICONS.reconcile aria-hidden />
              {t("banking.explorer.reconcile")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onImport}>
              <MENU_ICONS.importStatement aria-hidden />
              {t("banking.explorer.importStatement")}
            </DropdownMenuItem>
          </>
        )}
        {!archived && canRecord && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRecord("in")}>
              <MENU_ICONS.moneyIn aria-hidden />
              {t("banking.explorer.moneyIn")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRecord("out")}>
              <MENU_ICONS.moneyOut aria-hidden />
              {t("banking.explorer.moneyOut")}
            </DropdownMenuItem>
            {canRecordTransfer && (
              <DropdownMenuItem onSelect={() => onRecord("transfer")}>
                <MENU_ICONS.transfer aria-hidden />
                {t("banking.explorer.transfer")}
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
                {t("banking.explorer.setDefault")}
              </DropdownMenuItem>
            )}
            {!archived && (
              <DropdownMenuItem onSelect={onEdit}>
                <MENU_ICONS.edit aria-hidden />
                {t("banking.explorer.edit")}
              </DropdownMenuItem>
            )}
            {archived ? (
              <DropdownMenuItem onSelect={onRestore}>
                <MENU_ICONS.restore aria-hidden />
                {t("banking.explorer.restore")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onArchive}>
                <MENU_ICONS.archive aria-hidden />
                {t("banking.explorer.archive")}
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
