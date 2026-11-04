"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleCheck, Landmark, ListFilter, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Badge,
  Button,
  DataTable,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type TableColumn,
} from "@spine/ui";
import {
  MONEY_ACCOUNT_KIND_LABELS,
  REGISTER_TYPES,
  REGISTER_TYPE_LABELS,
  filterRegisterRows,
  statementImportSummary,
  type AccountRegister as Register,
  type AccountRegisterRow,
  type BankTransaction,
  type BankTransfer,
  type MoneyAccount,
  type RegisterType,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { replaceQuery } from "../../../lib/replace-query";
import { useToast } from "../../../components/toast-host";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { formatDay, fromIsoDate, toIsoDate } from "./dates";
import { StatementImportDialog } from "./statement-import-dialog";
import { MoneyAccountDialog } from "./money-account-dialog";
import { MoneyInOutDialog } from "./money-in-out-dialog";
import { TransferDialog } from "./transfer-dialog";
import { RegisterEntryDrawer, type DrawerEntry } from "./register-entry-drawer";
import { REGISTER_RANGES, REGISTER_RANGE_LABELS, opensDrawer, parseRegisterState, rangeDates, registerQuery, sourceHref, type RegisterRange, type RegisterState } from "./register-state";
import { useLoadFailure } from "../../../lib/use-load-failure";

const TABLE_COLUMNS = [
  { key: "date", header: "Date", width: "w-24" },
  { key: "what", header: "What", width: "w-40" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "in", header: "Money in", width: "w-24" },
  { key: "out", header: "Money out", width: "w-24" },
  { key: "balance", header: "Balance", width: "w-24" },
];

const ALL = "__all__";

/**
 * US-BANK-02, US-BANK-14 (D-210, D-231) — `AccountRegister`: everything
 * that went in or out of one money account, with a running balance that
 * starts from the true balance before the range. Reconcile is the one
 * primary action, with Record and More beside it; the range, Type, Show and
 * search are kept in the address; a reconciled entry has a tick; money in
 * and out and transfers open a drawer; Export holds what's on screen. A
 * card reads "Paid off", "Spent" and "Owed".
 */
export function AccountRegisterView({ accountId }: { accountId: string }) {
  const loadFailed = useLoadFailure(accountId);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<RegisterState>(() => parseRegisterState(new URLSearchParams(searchParams.toString())));
  const [register, setRegister] = useState<Register | null>(null);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [drawer, setDrawer] = useState<DrawerEntry | null>(null);
  const [recording, setRecording] = useState<"in" | "out" | "transfer" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const loading = useRef(false);
  const canRecord = useCapability("banking.record");
  const canReconcile = useCapability("banking.reconcile");
  const isOwner = useMyRole() === "owner";
  const showToast = useToast();

  function update(patch: Partial<RegisterState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, registerQuery(next));
  }

  const dates = useMemo(() => rangeDates(state, new Date()), [state]);

  const load = useCallback(
    async (mode: "first" | "refresh") => {
      if (loading.current) return;
      loading.current = true;
      if (mode === "refresh") setRefreshing(true);
      const query = new URLSearchParams({ from: dates.from, to: dates.to, unreconciled: String(state.unreconciled) });
      try {
        setRegister(await apiClient.get<Register>(`/money-accounts/${accountId}/register?${query}`));
        setError(null);
        setUpdatedAt(Date.now());
        setNow(Date.now());
      } catch (err) {
        if (loadFailed(err)) return;
        setError(err instanceof Error ? err.message : "Couldn't load this account. Refresh to try again.");
      } finally {
        loading.current = false;
        setRefreshing(false);
      }
    },
    [accountId, dates.from, dates.to, state.unreconciled],
  );

  useEffect(() => {
    void load("first");
  }, [load]);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? "USD"))
      .catch(() => {});
    apiClient.get<MoneyAccount[]>("/money-accounts").then(setAccounts).catch(() => {});
  }, []);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const account = register?.account;
  const archived = Boolean(account?.archivedAt);
  const isCard = account?.kind === "card";
  const inLabel = isCard ? "Paid off" : "Money in";
  const outLabel = isCard ? "Spent" : "Money out";
  const money = (amount: string) => formatMoney(BigInt(amount), currency);
  const rangeLabel = `${formatDay(dates.from)} – ${formatDay(dates.to)}`;
  // Newest first; each row's balance is the running balance after it.
  const rows = useMemo(() => (register ? filterRegisterRows([...register.rows].reverse(), { type: state.type, search: state.q }) : null), [register, state.type, state.q]);
  const unreconciledCount = register ? register.rows.filter((r) => !r.reconciled).length : 0;

  function recorded(title: string, description: string) {
    setRecording(null);
    showToast(title, description);
    void load("refresh");
  }

  const columns: TableColumn<AccountRegisterRow>[] = [
    { key: "date", header: "Date", render: (row) => <span className="whitespace-nowrap">{formatDay(row.date)}</span>, sortValue: (row) => row.date },
    {
      key: "what",
      header: "What",
      render: (row) => {
        const href = sourceHref(row);
        const drawerKind = opensDrawer(row.sourceType);
        const label = href ? (
          <Link href={href} className="whitespace-nowrap font-medium text-primary hover:underline">
            {row.what}
          </Link>
        ) : drawerKind ? (
          <button type="button" className="whitespace-nowrap text-left font-medium text-primary hover:underline" onClick={() => setDrawer({ kind: drawerKind, id: row.sourceId, what: row.what })}>
            {row.what}
          </button>
        ) : (
          <span className="font-medium text-on-surface">{row.what}</span>
        );
        // The original entry of something deleted later; its reversal is its own row.
        const showDeleted = row.deleted && !row.sourceType.endsWith("_delete");
        return (
          <span className="flex flex-wrap items-center gap-2">
            {label}
            {showDeleted && <Badge>Deleted</Badge>}
          </span>
        );
      },
      sortValue: (row) => row.what,
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) =>
        row.contact ? (
          <span className="block max-w-36 truncate" title={row.contact.name}>
            {row.contact.name}
          </span>
        ) : (
          <span className="text-on-surface-muted">—</span>
        ),
      sortValue: (row) => row.contact?.name ?? "",
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => (
        <span className="block max-w-28 truncate text-on-surface-muted" title={row.reference ?? undefined}>
          {row.reference ?? "—"}
        </span>
      ),
    },
    { key: "in", header: inLabel, align: "right", render: (row) => (row.in !== "0" ? <span className="tabular-nums">{money(row.in)}</span> : null), sortValue: (row) => BigInt(row.in) },
    { key: "out", header: outLabel, align: "right", render: (row) => (row.out !== "0" ? <span className="tabular-nums">{money(row.out)}</span> : null), sortValue: (row) => BigInt(row.out) },
    { key: "balance", header: isCard ? "Owed" : "Balance", align: "right", render: (row) => <span className="tabular-nums">{money(row.balance)}</span> },
    {
      key: "reconciled",
      header: "Reconciled",
      render: (row) =>
        row.reconciled ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-paid">
            <CircleCheck size={15} aria-hidden />
            Reconciled
          </span>
        ) : (
          <span className="sr-only">Not reconciled</span>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const href = sourceHref(row);
        const drawerKind = opensDrawer(row.sourceType);
        if (!href && !drawerKind) return null;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${row.what}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
                >
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {href ? (
                  <DropdownMenuItem onSelect={() => router.push(href)}>
                    <MENU_ICONS.open aria-hidden />
                    Open
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setDrawer({ kind: drawerKind!, id: row.sourceId, what: row.what })}>
                    <MENU_ICONS.openDrawer aria-hidden />
                    View entry
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const subtitle = account ? [account.bankName, account.last4 ? `••${account.last4}` : null, MONEY_ACCOUNT_KIND_LABELS[account.kind], `ledger ${account.code}`].filter(Boolean).join(" · ") : undefined;
  const exportQuery = new URLSearchParams({ from: dates.from, to: dates.to, unreconciled: String(state.unreconciled), ...(state.type ? { type: state.type } : {}) });

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: "Money" }, { label: "Banking", href: "/banking" }, { label: account?.name ?? "Account" }]}
      title={account?.name ?? "Account"}
      description={subtitle}
      action={
        account ? (
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  More
                  <ChevronDown size={14} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canReconcile && !archived && (
                  <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                    <MENU_ICONS.importStatement aria-hidden />
                    Import statement
                  </DropdownMenuItem>
                )}
                {canReconcile && (
                  <DropdownMenuItem onSelect={() => router.push(`/banking/${accountId}/reconciliations`)}>
                    <MENU_ICONS.history aria-hidden />
                    Reconciliations
                  </DropdownMenuItem>
                )}
                {isOwner && !archived && (
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <MENU_ICONS.edit aria-hidden />
                    Edit account
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {canRecord && !archived && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    <Plus size={14} aria-hidden />
                    Record
                    <ChevronDown size={14} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRecording("in")}>
                    <MENU_ICONS.moneyIn aria-hidden />
                    Money in
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRecording("out")}>
                    <MENU_ICONS.moneyOut aria-hidden />
                    Money out
                  </DropdownMenuItem>
                  {accounts.length > 1 && (
                    <DropdownMenuItem onSelect={() => setRecording("transfer")}>
                      <MENU_ICONS.transfer aria-hidden />
                      Transfer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canReconcile && !archived && (
              <Button asChild>
                <Link href={`/banking/${accountId}/reconcile`}>
                  <MENU_ICONS.reconcile size={14} aria-hidden />
                  Reconcile
                </Link>
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );

  if (error && !register) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </>
    );
  }

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder="Search what, contact or reference" aria-label="Search entries" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="register-cards">
          <StatCard label={isCard ? "Owed on this card" : "Balance in Spine"} value={account ? money(account.balance) : "—"} trend={{ direction: "neutral", label: `as of ${formatDay(toIsoDate(new Date()))}` }} className="h-full" />
          <StatCard label={inLabel} value={register ? money(register.totalIn) : "—"} trend={{ direction: "neutral", label: rangeLabel }} className="h-full" />
          <StatCard label={outLabel} value={register ? money(register.totalOut) : "—"} trend={{ direction: "neutral", label: rangeLabel }} className="h-full" />
          <button
            type="button"
            aria-pressed={state.unreconciled}
            aria-label="Show unreconciled entries only"
            onClick={() => update({ unreconciled: !state.unreconciled })}
            className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <StatCard
              label="Unreconciled"
              value={register ? String(unreconciledCount) : "—"}
              tone={unreconciledCount > 0 ? "warning" : "default"}
              trend={{ direction: "neutral", label: state.unreconciled ? "Showing these · press again to clear" : "entries in this range" }}
              className={cn("h-full transition-colors hover:border-border-strong", state.unreconciled && "border-primary bg-info-bg/60 ring-1 ring-primary")}
            />
            <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", state.unreconciled ? "text-primary" : "text-on-surface-muted")} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={state.range}
              onValueChange={(v) => {
                const range = v as RegisterRange;
                update(range === "custom" ? { range, from: dates.from, to: dates.to } : { range, from: null, to: null });
              }}
            >
              <SelectTrigger aria-label="Date range" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGISTER_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REGISTER_RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.range === "custom" && (
              <>
                <div className="w-40">
                  <DatePicker value={fromIsoDate(dates.from)} onChange={(d) => d && update({ from: toIsoDate(d) })} placeholder="From" />
                </div>
                <div className="w-40">
                  <DatePicker value={fromIsoDate(dates.to)} onChange={(d) => d && update({ to: toIsoDate(d) })} placeholder="To" />
                </div>
              </>
            )}
            <Select value={state.type ?? ALL} onValueChange={(v) => update({ type: v === ALL ? null : (v as RegisterType) })}>
              <SelectTrigger aria-label="Filter by type" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All entries</SelectItem>
                {REGISTER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REGISTER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={state.unreconciled ? "unreconciled" : "all"} onValueChange={(v) => update({ unreconciled: v === "unreconciled" })}>
              <SelectTrigger aria-label="Which entries" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unreconciled">Unreconciled only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="register-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            <ReportExportMenu path={`/money-accounts/${accountId}/register?${exportQuery}`} search={state.q} />
          </div>
        </div>

        {!register ? (
          <TableSkeleton columns={TABLE_COLUMNS} />
        ) : !register.hasEntries ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<Landmark />} title="Nothing has gone in or out of this account yet." description="Payments, expenses and transfers on this account appear here." />
          </div>
        ) : rows!.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex">{search}</div>
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={<Landmark />}
                title="No entries match"
                description={`Nothing in ${rangeLabel} matches these filters.`}
                action={
                  <Button variant="secondary" onClick={() => update({ type: null, unreconciled: false, q: "" })}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div data-testid="register-table" className="flex flex-col gap-3">
            <DataTable columns={columns} data={rows!} rowKey={(row) => row.journalLineId} toolbarStart={search} configurablePageSize page={state.page} onPageChange={(page) => update({ page })} />
            <p className="text-[13px] text-on-surface-muted">
              {isCard ? "Owed" : "Opening balance"} on {formatDay(register.from ?? dates.from)}: <span className="font-semibold text-on-surface">{money(register.openingBalance)}</span>
            </p>
          </div>
        )}
      </div>

      <RegisterEntryDrawer
        entry={drawer}
        currency={currency}
        canDelete={canRecord}
        onOpenChange={(open) => !open && setDrawer(null)}
        onDeleted={(kind) => {
          setDrawer(null);
          showToast(
            kind === "bank_transfer" ? "Transfer deleted" : "Entry deleted",
            kind === "bank_transfer" ? "A reversing entry was posted, so both balances are back where they were." : "A reversing entry was posted, so the balance is back where it was.",
          );
          void load("refresh");
        }}
      />
      {account && (
        <>
          <MoneyInOutDialog
            direction={recording === "out" ? "out" : "in"}
            open={recording === "in" || recording === "out"}
            onOpenChange={(open) => !open && setRecording(null)}
            accounts={accounts.length ? accounts : [account]}
            currency={currency}
            initialAccountId={accountId}
            onRecorded={(entry: BankTransaction) =>
              recorded(`${entry.direction === "in" ? "Money in" : "Money out"} recorded`, `${formatMoney(BigInt(entry.amount), currency)} ${entry.direction === "in" ? "into" : "from"} ${entry.moneyAccount.name} — ${entry.account.name}.`)
            }
          />
          <TransferDialog
            open={recording === "transfer"}
            onOpenChange={(open) => !open && setRecording(null)}
            accounts={accounts}
            currency={currency}
            initialAccountId={accountId}
            onRecorded={(transfer: BankTransfer) => recorded(`Moved ${formatMoney(BigInt(transfer.amount), currency)} from ${transfer.fromMoneyAccount.name} to ${transfer.toMoneyAccount.name}`, "Both registers show the transfer.")}
          />
          <StatementImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            accountId={accountId}
            accountName={account.name}
            onImported={(result) => showToast("Statement imported", statementImportSummary(result))}
          />
          <MoneyAccountDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            account={account}
            onSaved={(saved) => {
              showToast("Account saved", `${saved.name} has been updated.`);
              void load("refresh");
            }}
          />
        </>
      )}
    </>
  );
}
