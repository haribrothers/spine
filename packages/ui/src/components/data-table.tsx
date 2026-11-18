"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import { Table, type TableColumn, type TableSort } from "./table";

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  configurablePageSize?: boolean;
  pageSizeOptions?: number[];
  searchPlaceholder?: string;
  searchKey?: (row: T) => string;
  /** Called with the search text as it changes — lets a page export exactly the rows on screen. */
  onSearchChange?: (query: string) => void;
  className?: string;
  /** Passed straight through to `Table` — see that component's own doc comment for grouped/expandable-row mode. */
  groupBy?: (row: T) => string;
  groupPrimary?: (rows: T[]) => T;
  groupMemberLabel?: (row: T) => React.ReactNode;
  /** Passed to `Table`: a totals row keyed by column. */
  footer?: Partial<Record<string, React.ReactNode>>;
  /** Passed to `Table`: the page, when the parent keeps it. */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Shown in place of the built-in search box, left of "Columns" — for a page whose own search covers every view (US-CRM-23). */
  toolbarStart?: React.ReactNode;
  /** Passed to `Table`: selectable rows (US-CAT-12). */
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  selectLabel?: (row: T) => string;
  /** Passed to `Table`: the sort, when the parent keeps it (US-CAT-13). */
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  /** Columns hidden until turned on in Columns (US-CAT-11). */
  defaultHidden?: string[];
  /** Passed to `Table`: rows that open to show more under them (US-PAY-27). */
  renderExpanded?: (row: T) => React.ReactNode;
  expandLabel?: (row: T, expanded: boolean) => string;
  /** US-OPS-56: on a phone, the rows show checkboxes only in Select mode. */
  phoneSelecting?: boolean;
  /** US-OPS-56: false keeps it a table on a phone. */
  phoneRows?: boolean;
}

/**
 * Table plus a search box and a column-visibility toggle — the richer
 * layer for a full data-management screen (e.g. the invoice list), where
 * plain Table (sortable + paginated only) is enough for embedded contexts
 * like a quote's line items.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize,
  configurablePageSize,
  pageSizeOptions,
  searchPlaceholder,
  searchKey,
  onSearchChange,
  className,
  groupBy,
  groupPrimary,
  groupMemberLabel,
  footer,
  page,
  onPageChange,
  toolbarStart,
  selected,
  onSelectedChange,
  selectLabel,
  sort,
  onSortChange,
  defaultHidden,
  renderExpanded,
  expandLabel,
  phoneSelecting,
  phoneRows,
}: DataTableProps<T>) {
  const t = useT();
  // US-OPS-56: a phone row places every column by its role, so Columns isn't offered there.
  const phone = usePhone() && phoneRows !== false;
  const searchText = searchPlaceholder ?? t("ui.dataTable.searchPlaceholder");
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden ?? []));

  const filtered = searchKey && query ? data.filter((row) => searchKey(row).toLowerCase().includes(query.toLowerCase())) : data;
  const visibleColumns = columns.filter((column) => !hidden.has(column.key));

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3" data-print="hide">
        {toolbarStart ? (
          toolbarStart
        ) : searchKey ? (
          <Input
            placeholder={searchText}
            aria-label={searchText}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearchChange?.(event.target.value);
            }}
            className="w-64 max-md:w-full"
          />
        ) : (
          <div />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className={phone ? "hidden" : undefined}>
            <Button variant="secondary" size="sm">
              <SlidersHorizontal size={14} />
              {t("ui.dataTable.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={!hidden.has(column.key)}
                onCheckedChange={(checked) => {
                  setHidden((current) => {
                    const next = new Set(current);
                    if (checked) next.delete(column.key);
                    else next.add(column.key);
                    return next;
                  });
                }}
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Table
        columns={phone ? columns : visibleColumns}
        data={filtered}
        rowKey={rowKey}
        pageSize={pageSize}
        configurablePageSize={configurablePageSize}
        pageSizeOptions={pageSizeOptions}
        groupBy={groupBy}
        groupPrimary={groupPrimary}
        groupMemberLabel={groupMemberLabel}
        footer={footer}
        page={page}
        onPageChange={onPageChange}
        selected={selected}
        onSelectedChange={onSelectedChange}
        selectLabel={selectLabel}
        sort={sort}
        onSortChange={onSortChange}
        renderExpanded={renderExpanded}
        expandLabel={expandLabel}
        phoneSelecting={phoneSelecting}
        phoneRows={phoneRows}
      />
    </div>
  );
}
