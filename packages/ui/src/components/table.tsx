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
import { usePhone } from "../lib/use-phone";
import { Button } from "./button";
import { ListRow } from "./list-row";

/**
 * US-OPS-56 (D-283) — where a column's value goes in a phone row: the title (number or name),
 * the status badge, the second line, the amount on the right and the line under it, or the
 * row's ⋯. "select" is a list's own checkbox, shown only in Select mode. "hidden" leaves it
 * out on a phone. Unset, a column is placed by `phoneRoles`.
 */
export type TablePhoneRole = "title" | "badge" | "subtitle" | "trailing" | "trailingSub" | "action" | "select" | "hidden";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | bigint;
  align?: "left" | "right";
  /** US-OPS-56: its place in a phone row. */
  phone?: TablePhoneRole;
}

/**
 * Each column's place in a phone row: the roles a list gives, and for the rest the first
 * column as the title, a status column as the badge, the second as the subtitle, the last
 * right-aligned one as the amount and an actions column as the ⋯. Others are left out.
 */
export function phoneRoles<T>(columns: TableColumn<T>[]): Map<string, TablePhoneRole> {
  const roles = new Map<string, TablePhoneRole>();
  for (const c of columns) if (c.phone) roles.set(c.key, c.phone);
  const taken = (role: TablePhoneRole) => [...roles.values()].includes(role);
  const free = columns.filter((c) => !roles.has(c.key));
  const pick = (role: TablePhoneRole, find: (c: TableColumn<T>) => boolean) => {
    if (taken(role)) return;
    const column = free.find((c) => !roles.has(c.key) && find(c));
    if (column) roles.set(column.key, role);
  };
  pick("select", (c) => c.key === "select");
  pick("action", (c) => c.key === "actions");
  pick("action", (c) => c.header === "" && c.key !== "select");
  pick("badge", (c) => /status|state/i.test(c.key));
  pick("title", () => true);
  const lastRight = [...free].reverse().find((c) => !roles.has(c.key) && c.align === "right");
  if (lastRight && !taken("trailing")) roles.set(lastRight.key, "trailing");
  pick("subtitle", (c) => c.align !== "right");
  for (const c of columns) if (!roles.has(c.key)) roles.set(c.key, "hidden");
  return roles;
}

// The phone row's slots, named once here (outside JSX).
const ROLE_TITLE: TablePhoneRole = "title";
const ROLE_SUBTITLE: TablePhoneRole = "subtitle";

/** US-OPS-56: a phone list shows this many rows, then Load more adds as many again. */
export const PHONE_PAGE = 25;

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
  /** US-OPS-56: on a phone, rows show their checkboxes only in Select mode (the page's Select button). */
  phoneSelecting?: boolean;
  /** US-OPS-56: false keeps a genuine grid a table on a phone (with `ScrollX`), for reports like the trial balance. */
  phoneRows?: boolean;
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
  phoneSelecting = false,
  phoneRows = true,
}: TableProps<T>) {
  const t = useT();
  const phone = usePhone();
  const [phoneShown, setPhoneShown] = useState(PHONE_PAGE);
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

  // US-OPS-56 (D-283): on a phone each record is a ListRow — no columns, headings or sideways scroll —
  // with Load more in place of pages. A grouped table shows each group's primary row (a quote's
  // latest version; the others open from the record); an expandable row has its chevron as its
  // action and opens underneath. Grids that ask to (phoneRows={false}) and print stay tables.
  if (phone && phoneRows && !printing) {
    const roles = phoneRoles(columns);
    const cell = (role: TablePhoneRole, row: T) => {
      const column = columns.find((c) => roles.get(c.key) === role);
      return column ? column.render(row) : null;
    };
    const footCell = (role: TablePhoneRole) => {
      const column = columns.find((c) => roles.get(c.key) === role);
      return column && footer ? footer[column.key] : null;
    };
    const all = groupBy ? (sortedGroups ?? []).map((g) => g.primary) : sorted;
    const rows = all.slice(0, phoneShown);
    const selecting = selectable && phoneSelecting;
    return (
      <div className={cn("flex flex-col gap-3", className)} data-testid="phone-list">
        {rows.length > 0 ? (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {rows.map((row) => {
              const key = rowKey(row);
              const chosen = selecting && selected!.has(key);
              const isOpen = expandable && expanded.has(key);
              const toggle = expandable ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${key}-more`}
                  aria-label={expandLabel ? expandLabel(row, isOpen) : isOpen ? t("ui.table.showLess") : t("ui.table.showMore")}
                  onClick={() => toggleExpanded(key)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronRight size={18} aria-hidden className={cn("transition-transform", isOpen && "rotate-90")} />
                </button>
              ) : null;
              return (
                <Fragment key={key}>
                <ListRow
                  selected={chosen}
                  leading={
                    selecting ? (
                      <Checkbox aria-label={selectLabel ? t("ui.table.selectNamed", { name: selectLabel(row) }) : t("ui.table.selectRow")} checked={chosen} onCheckedChange={() => toggleRow(key)} />
                    ) : phoneSelecting ? (
                      cell("select", row)
                    ) : undefined
                  }
                  title={cell(ROLE_TITLE, row)}
                  badge={cell("badge", row)}
                  subtitle={cell(ROLE_SUBTITLE, row)}
                  trailing={cell("trailing", row)}
                  trailingSub={cell("trailingSub", row)}
                  className={phoneSelecting ? "[&_[data-list-row-title]_a]:pointer-events-none" : undefined}
                  action={
                    phoneSelecting ? undefined : toggle ? (
                      <span className="flex items-center">
                        {cell("action", row)}
                        {toggle}
                      </span>
                    ) : (
                      cell("action", row)
                    )
                  }
                />
                {isOpen ? (
                  <li id={`${key}-more`} className="border-b border-border bg-surface-sunken/30 last:border-b-0">
                    {renderExpanded!(row)}
                  </li>
                ) : null}
                </Fragment>
              );
            })}
            {footer ? <ListRow title={footCell(ROLE_TITLE)} trailing={footCell("trailing")} className="bg-surface-sunken" /> : null}
          </ul>
        ) : null}
        {all.length > rows.length ? (
          <div className="flex flex-col items-center gap-1">
            <Button variant="secondary" className="w-full" onClick={() => setPhoneShown((n) => n + PHONE_PAGE)}>
              {t("ui.table.loadMore")}
            </Button>
            <p className="text-[12px] text-on-surface-muted" aria-live="polite">
              {t("ui.table.shownOf", { shown: rows.length, total: all.length })}
            </p>
          </div>
        ) : null}
      </div>
    );
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
