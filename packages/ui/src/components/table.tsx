"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { ScrollX } from "./scroll-x";
import { useT } from "../lib/i18n";
import { Checkbox } from "./checkbox";
import { Pagination } from "./pagination";
import { PaginationBar } from "./pagination-bar";
import { usePrintMode } from "../lib/print-mode";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | bigint;
  align?: "left" | "right";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  /** Lets the viewer change rows-per-page via a <select> instead of a fixed `pageSize`; overrides `pageSize` as the initial value. */
  configurablePageSize?: boolean;
  pageSizeOptions?: number[];
  className?: string;
  /**
   * Clusters rows that share a key (e.g. every version of the same quote)
   * into one expandable group instead of showing every row flat — for a
   * dataset where rows have a natural parent/version relationship, per
   * §S-03.8's revision history. When set, sorting and pagination operate
   * over GROUPS, not raw rows (a group's own sortValue comes from its
   * `groupPrimary` row) — a page of N shows N groups, each possibly
   * expanding to reveal more rows, not N individual rows. Omit for a plain
   * flat table (the default, unchanged behavior).
   */
  groupBy?: (row: T) => string;
  /** Picks which row of a group renders as its collapsed/header row — defaults to the first row in `data`'s own order for that group. Typically "the newest version." */
  groupPrimary?: (rows: T[]) => T;
  /** Optional badge/label rendered next to the expand chevron on a group's non-primary rows, e.g. "v1". Only used when `groupBy` is set. */
  groupMemberLabel?: (row: T) => React.ReactNode;
  /** A totals row under every page, keyed by column (a report's "Total"); columns left out stay blank. */
  footer?: Partial<Record<string, React.ReactNode>>;
  /**
   * The page, when the parent keeps it (e.g. in the address, US-CRM-23).
   * Controlled, it doesn't jump back to 1 when `data` changes (a refresh
   * keeps your place); a page past the end shows the last page.
   */
  page?: number;
  onPageChange?: (page: number) => void;
  /**
   * US-CAT-12 — selectable rows: a checkbox column (named by `selectLabel`)
   * and a header box that selects or clears the rows on this page. The
   * parent keeps the selection (row keys).
   */
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  selectLabel?: (row: T) => string;
  /** US-CAT-13 — the sort, when the parent keeps it (e.g. in the address). */
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  /**
   * US-PAY-27 — rows that open to show more under them (a customer's
   * invoices): a chevron button (`aria-expanded`) in a first column, and a
   * full-width row under an open one. Flat tables only (not with `groupBy`).
   */
  renderExpanded?: (row: T) => React.ReactNode;
  /** The chevron's accessible name, e.g. "Show Halcyon's invoices"; defaults to "Show more" / "Show less". */
  expandLabel?: (row: T, expanded: boolean) => string;
}

export type SortDirection = "asc" | "desc";
export interface TableSort {
  key: string;
  direction: SortDirection;
}

/**
 * Zero-radius, dense row height, sticky header, sortable columns, and
 * client-side pagination — the primary vehicle for quote/invoice line
 * items and the AR/AP aging report, per docs/DESIGN.md.
 */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface Group<T> {
  key: string;
  primary: T;
  rest: T[];
}

export function Table<T>({
  columns,
  data,
  rowKey,
  pageSize: pageSizeProp,
  configurablePageSize = false,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
  groupBy,
  groupPrimary,
  groupMemberLabel,
  footer,
  page: pageProp,
  onPageChange,
  selected,
  onSelectedChange,
  selectLabel,
  sort: sortProp,
  onSortChange,
  renderExpanded,
  expandLabel,
}: TableProps<T>) {
  const t = useT();
  const [sortState, setSortState] = useState<TableSort | null>(null);
  const sortControlled = sortProp !== undefined;
  const sort = sortControlled ? sortProp : sortState;
  const setSort = (update: (current: TableSort | null) => TableSort | null) => {
    const next = update(sort);
    if (sortControlled) onSortChange?.(next);
    else setSortState(next);
  };
  const selectable = Boolean(selected && onSelectedChange);
  const expandable = Boolean(renderExpanded) && !groupBy;
  const [pageState, setPageState] = useState(1);
  const controlled = pageProp !== undefined;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // configurablePageSize's <select> only ever offers pageSizeOptions, so the
  // initial pageSize must be one of them too — otherwise the <select> falls
  // back to displaying its first option while the real state stays at
  // whatever pageSizeProp/20 was, silently mismatching the label shown.
  const [pageSize, setPageSize] = useState(pageSizeProp ?? (configurablePageSize ? pageSizeOptions[0]! : 20));

  useEffect(() => {
    if (!controlled) setPageState(1);
  }, [data, pageSize, controlled]);

  // Grouped mode: cluster `data` by `groupBy(row)` into one Group per key
  // (a group of size 1 — no siblings — behaves exactly like a flat row,
  // just with no expand affordance rendered). Sorting/pagination below then
  // operate on `groups`, not `data`, when groupBy is set.
  const groups = useMemo<Group<T>[] | null>(() => {
    if (!groupBy) return null;
    const byKey = new Map<string, T[]>();
    for (const row of data) {
      const key = groupBy(row);
      const existing = byKey.get(key);
      if (existing) existing.push(row);
      else byKey.set(key, [row]);
    }
    return Array.from(byKey.entries()).map(([key, rows]) => {
      const primary = groupPrimary ? groupPrimary(rows) : rows[0]!;
      return { key, primary, rest: rows.filter((r) => r !== primary) };
    });
  }, [data, groupBy, groupPrimary]);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [data, sort, columns]);

  const sortedGroups = useMemo(() => {
    if (!groups) return null;
    if (!sort) return groups;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return groups;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...groups].sort((a, b) => {
      const av = column.sortValue!(a.primary);
      const bv = column.sortValue!(b.primary);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [groups, sort]);

  const pageCount = groupBy
    ? Math.max(1, Math.ceil((sortedGroups?.length ?? 0) / pageSize))
    : Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(controlled ? Math.max(1, pageProp) : pageState, pageCount);
  const setPage = (next: number) => (controlled ? onPageChange?.(next) : setPageState(next));
  const changePageSize = (next: number) => {
    setPageSize(next);
    if (controlled) onPageChange?.(1);
  };
  // US-RPT-34 — "Print" shows every row, not just this page.
  const printing = usePrintMode();
  const pageRows = printing ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);
  const pageGroups = (printing ? sortedGroups : sortedGroups?.slice((page - 1) * pageSize, page * pageSize)) ?? [];
  const groupTotal = sortedGroups?.length ?? 0;

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const pageKeys = pageRows.map((row) => rowKey(row));
  const pageSelected = selectable ? pageKeys.filter((k) => selected!.has(k)).length : 0;
  function togglePage() {
    if (!selectable) return;
    const next = new Set(selected);
    if (pageSelected === pageKeys.length) for (const k of pageKeys) next.delete(k);
    else for (const k of pageKeys) next.add(k);
    onSelectedChange!(next);
  }
  function toggleRow(key: string) {
    if (!selectable) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange!(next);
  }

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ScrollX label={t("ui.scrollX.label")} className="rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-[var(--z-sticky-header)] border-b border-border bg-surface-sunken">
            <tr>
              {expandable && (
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">{t("ui.table.open")}</span>
                </th>
              )}
              {selectable && !groupBy && (
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label={t("ui.table.selectPage")}
                    checked={pageSelected === 0 ? false : pageSelected === pageKeys.length ? true : "indeterminate"}
                    onCheckedChange={togglePage}
                    disabled={pageKeys.length === 0}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    column.sortValue
                      ? sort?.key === column.key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium text-on-surface-muted",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupBy
              ? pageGroups.map((group) => {
                  const isExpanded = expanded.has(group.key);
                  return (
                    <Fragment key={group.key}>
                      <tr className="border-b border-border last:border-0 hover:bg-surface-sunken">
                        {columns.map((column, columnIndex) => (
                          <td
                            key={column.key}
                            className={cn(
                              "whitespace-nowrap px-3 py-2 text-on-surface",
                              column.align === "right" ? "text-right" : "text-left",
                            )}
                          >
                            {columnIndex === 0 && group.rest.length > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(group.key)}
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? t("ui.table.collapseVersions") : t("ui.table.showVersions", { count: group.rest.length })}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
                                </button>
                                {column.render(group.primary)}
                              </div>
                            ) : (
                              column.render(group.primary)
                            )}
                          </td>
                        ))}
                      </tr>
                      {isExpanded &&
                        group.rest.map((row) => (
                          <tr key={rowKey(row)} className="border-b border-border bg-surface-sunken/40 last:border-0 hover:bg-surface-sunken">
                            {columns.map((column, columnIndex) => (
                              <td
                                key={column.key}
                                className={cn(
                                  "whitespace-nowrap px-3 py-2 text-on-surface-muted",
                                  column.align === "right" ? "text-right" : "text-left",
                                )}
                              >
                                {columnIndex === 0 ? (
                                  <div className="flex items-center gap-1.5 pl-[26px]">
                                    {groupMemberLabel?.(row)}
                                    {column.render(row)}
                                  </div>
                                ) : (
                                  column.render(row)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
              : pageRows.map((row) => {
                  const key = rowKey(row);
                  const isSelected = selectable && selected!.has(key);
                  const isOpen = expandable && expanded.has(key);
                  return (
                  <Fragment key={key}>
                  <tr
                    aria-selected={selectable ? isSelected : undefined}
                    className={cn("border-b border-border last:border-0 hover:bg-surface-sunken", isSelected && "bg-info-bg/70 hover:bg-info-bg", isOpen && "bg-surface-sunken/60")}
                  >
                    {expandable && (
                      <td className="w-10 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={isOpen}
                          aria-controls={`${key}-more`}
                          aria-label={expandLabel ? expandLabel(row, isOpen) : isOpen ? t("ui.table.showLess") : t("ui.table.showMore")}
                          className="flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <ChevronRight size={16} aria-hidden className={cn("motion-safe:transition-transform", isOpen && "rotate-90")} />
                        </button>
                      </td>
                    )}
                    {selectable && (
                      <td className="w-10 px-3 py-2">
                        <Checkbox aria-label={selectLabel ? t("ui.table.selectNamed", { name: selectLabel(row) }) : t("ui.table.selectRow")} checked={isSelected} onCheckedChange={() => toggleRow(key)} />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap px-3 py-2 text-on-surface",
                          column.align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr id={`${key}-more`} className="border-b border-border bg-surface-sunken/30 last:border-0">
                      <td colSpan={columns.length + (selectable ? 1 : 0) + 1} className="p-0">
                        {renderExpanded!(row)}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t border-border bg-surface-sunken font-semibold text-on-surface">
                {expandable && <td />}
                {selectable && !groupBy && <td />}
                {columns.map((column) => (
                  <td key={column.key} className={cn("whitespace-nowrap px-3 py-2.5", column.align === "right" ? "text-right tabular-nums" : "text-left")}>
                    {footer[column.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </ScrollX>
      {configurablePageSize ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          total={groupBy ? groupTotal : data.length}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      ) : (
        pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="self-end" />
      )}
    </div>
  );
}
