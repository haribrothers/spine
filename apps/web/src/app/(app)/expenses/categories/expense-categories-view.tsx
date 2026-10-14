"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Badge, Button, Combobox, DataTable, EmptyState, Input, Tooltip, TooltipContent, TooltipTrigger, cn, type TableColumn } from "@spine/ui";
import { Plus, RefreshCw, Search, Tags } from "lucide-react";
import { templateSeedNote, type ExpenseCategoryUsage, type TemplateSeedResult } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { replaceQuery } from "../../../../lib/replace-query";
import { useCapability } from "../../../../lib/capabilities-context";
import { useToast } from "../../../../components/toast-host";
import { ActionError } from "../../../../components/action-error";
import { HistorySection } from "../../../../components/history-section";
import { updatedLabel } from "../../contacts/contacts-list-state";
import type { ExpenseCategory } from "../types";
import { ExpenseCategoryDialog, FALLBACK_ACCOUNT_LABEL, type AccountOption, type TaxRateOption } from "./category-dialog";
import { CategoryRowActions } from "./category-row-actions";
import { CATEGORY_STATE_OPTIONS, categoriesQuery, filterCategories, hasCategoryFilters, isLabourCategory, parseCategoriesState, usageFor, type CategoriesListState, type CategoryStateFilter } from "./category-state";

/**
 * US-PUR-46, US-PUR-47 (D-228) — Expenses › Categories on the layout every
 * refined list shares (D-210): the state filter (Active by default) on the
 * left with Updated, Refresh and Add category on the right, search below,
 * then a table of each category's name over what it's for, the account it
 * posts to, its default tax rate, how many expenses use it (opening the
 * expenses list filtered to it), what was approved in it this month, and
 * Active or Archived in words. Changes go through one form and the row
 * menu, ask first where they remove something, and toast (D-223).
 */
export function ExpenseCategoriesView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const canCreate = useCapability("expense_categories.edit_own");
  const [state, setState] = useState<CategoriesListState>(() => parseCategoriesState(new URLSearchParams(searchParams.toString())));
  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [usage, setUsage] = useState<ExpenseCategoryUsage[] | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [seedNote, setSeedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [history, setHistory] = useState<ExpenseCategory | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const loading = useRef(false);

  function update(patch: Partial<CategoriesListState>) {
    const next = { ...state, ...patch };
    setState(next);
    replaceQuery(pathname, categoriesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const [rows, figures] = await Promise.all([
        apiClient.get<ExpenseCategory[]>("/expense-categories?includeArchived=true"),
        apiClient.get<ExpenseCategoryUsage[]>("/expense-categories/usage").catch(() => null),
      ]);
      setCategories(rows);
      setUsage(figures);
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Couldn't load the categories.");
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient
      .get<Record<string, AccountOption[]>>("/org/accounts")
      .then((grouped) => setAccounts(grouped.expense ?? []))
      .catch(() => {});
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
    // US-ONB-13 — what the industry template set up, if it ran.
    apiClient
      .get<{ value: TemplateSeedResult | null }>("/org/settings/industry_template_seed")
      .then((res) => setSeedNote(res.value ? templateSeedNote(res.value) : null))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(() => (categories ? filterCategories(categories, state) : null), [categories, state]);
  const done = (title: string, description: string) => {
    showToast(title, description);
    void load("refresh");
  };
  const failed = (title: string, message: string) => setActionError({ title, message });
  const handlers = { onEdit: (c: ExpenseCategory) => (setEditing(c), setFormOpen(true)), onHistory: setHistory, onDone: done, onFailed: failed };

  const columns: TableColumn<ExpenseCategory>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="flex min-w-0 max-w-96 flex-col">
          <span className="flex items-center gap-2 font-medium text-on-surface">
            <span className="truncate">{row.name}</span>
            {isLabourCategory(row) && <Badge className="border border-border bg-transparent text-on-surface-muted">Headcount × day rate</Badge>}
          </span>
          {row.description && <span className="truncate text-[12px] text-on-surface-muted">{row.description}</span>}
        </div>
      ),
      sortValue: (row) => row.name.toLowerCase(),
    },
    {
      key: "account",
      header: "Posts to",
      render: (row) => (row.accountCode ? `${row.accountCode} ${row.accountName ?? ""}` : <span className="text-on-surface-muted">{FALLBACK_ACCOUNT_LABEL}</span>),
      sortValue: (row) => row.accountCode ?? "6900",
    },
    { key: "tax", header: "Default tax", render: (row) => row.defaultTaxRateName ?? <span className="text-on-surface-muted">—</span>, sortValue: (row) => row.defaultTaxRateName ?? "" },
    {
      key: "count",
      header: "Expenses",
      align: "right",
      render: (row) => {
        const u = usageFor(usage, row.id);
        if (!u) return <span className="text-on-surface-muted">—</span>;
        return u.expenseCount ? (
          <Link href={`/expenses?category=${row.id}`} className="text-primary underline underline-offset-2" aria-label={`${u.expenseCount} expense${u.expenseCount === 1 ? "" : "s"} in ${row.name}`}>
            {u.expenseCount}
          </Link>
        ) : (
          <span className="text-on-surface-muted">0</span>
        );
      },
      sortValue: (row) => usageFor(usage, row.id)?.expenseCount ?? 0,
    },
    {
      key: "month",
      header: "Approved this month",
      align: "right",
      render: (row) => {
        const u = usageFor(usage, row.id);
        return u && u.approvedThisMonth > 0n ? <span className="tabular-nums">{formatMoney(u.approvedThisMonth, currency)}</span> : <span className="text-on-surface-muted">—</span>;
      },
      sortValue: (row) => usageFor(usage, row.id)?.approvedThisMonth ?? 0n,
    },
    {
      key: "state",
      header: "State",
      render: (row) =>
        row.archivedAt ? (
          <Badge className="border border-border bg-surface-sunken text-on-surface-muted" data-testid="category-state">
            Archived
          </Badge>
        ) : (
          <Badge className="bg-paid-bg text-paid" data-testid="category-state">
            Active
          </Badge>
        ),
      sortValue: (row) => (row.archivedAt ? 1 : 0),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <CategoryRowActions category={row} expenseCount={usageFor(usage, row.id)?.expenseCount ?? null} handlers={handlers} />
        </div>
      ),
    },
  ];

  const search = (
    <div className="relative w-full max-w-sm">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" />
      <Input value={state.q} onChange={(e) => update({ q: e.target.value })} placeholder="Search categories" aria-label="Search categories" className="pl-9" />
    </div>
  );
  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {seedNote && (
        <Alert variant="info">
          <AlertDescription>{seedNote}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Combobox options={CATEGORY_STATE_OPTIONS} value={state.state} onValueChange={(v) => update({ state: v as CategoryStateFilter })} aria-label="Filter by state" className="w-44" />
            {hasCategoryFilters(state) && (
              <Button variant="ghost" size="sm" onClick={() => update({ state: "active", q: "" })}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && <span className="whitespace-nowrap text-[12px] text-on-surface-muted">{refreshing ? "Updating…" : updatedLabel(updatedAt, now)}</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !categories} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            {canCreate && (
              <Button onClick={openNew}>
                <Plus size={14} aria-hidden />
                Add category
              </Button>
            )}
          </div>
        </div>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              Couldn&apos;t refresh the list. Check your connection and try again.
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-sunken motion-reduce:animate-none" aria-busy="true" aria-label="Loading categories" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {hasCategoryFilters(state) ? (
              <EmptyState
                icon={<Tags />}
                title="No categories match"
                description="Try another search or state."
                action={
                  <Button variant="secondary" onClick={() => update({ state: "active", q: "" })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Tags />}
                title="No expense categories yet"
                description="Categories say where an expense posts. Add one for each kind of spending — fuel, materials, site meals."
                action={canCreate ? <Button onClick={openNew}>Add category</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="categories-table">
          <DataTable columns={columns} data={rows} rowKey={(row) => row.id} toolbarStart={search} />
          <p className="text-[12.5px] text-on-surface-muted">Archived categories leave the expense form; their expenses keep them. A category no expense uses can be deleted.</p>
        </div>
      )}

      <ExpenseCategoryDialog
        category={editing}
        accounts={accounts}
        taxRates={taxRates}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={(saved, mode) => {
          setFormOpen(false);
          done(mode === "created" ? `${saved.name} added` : `${saved.name} saved`, mode === "created" ? "It's on the expense form now." : "Expenses approved from now on use these settings.");
        }}
        onRestored={(_, name) => {
          setFormOpen(false);
          done(`${name} restored`, "It's back on the expense form.");
        }}
      />
      {history && (
        <HistorySection endpoint={`/expense-categories/${history.id}/history`} subjectLabel={history.name} open onOpenChange={(open) => !open && setHistory(null)} />
      )}
    </div>
  );
}
