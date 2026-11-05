"use client";

import { Badge, DataTable, cn, type TableColumn, type TableSort } from "@spine/ui";
import { TriangleAlert } from "lucide-react";
import { CatalogRowActions } from "./catalog-row-actions";
import { taxLabel } from "./catalog-list-state";
import type { CatalogItem, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";

/**
 * The (only) list view for Catalogue — a flat table, no card/list-view
 * switcher like Contacts, since PRD F2's scope is a simple CRUD list, not a
 * pipeline or relationship-heavy entity worth multiple visualizations.
 * US-CAT-11 (D-213): the tax by name (or "No tax", flagged), HSN/SAC for a
 * GST business, the description under the name, and "Archived" only on
 * archived rows. US-CAT-12: rows can be selected.
 */
export function CatalogTable({
  items,
  gst,
  rates,
  groups,
  selected,
  onSelectedChange,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  onEdit,
  onDuplicate,
  onChanged,
}: {
  items: CatalogItem[];
  gst: boolean;
  rates: Map<string, TaxRateOption>;
  groups: Map<string, TaxGroupOption>;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  onEdit: (item: CatalogItem) => void;
  onDuplicate?: (item: CatalogItem) => void;
  onChanged: (action: "archived" | "restored" | "deleted", item: CatalogItem) => void;
}) {
  const t = useT();
  const columns: TableColumn<CatalogItem>[] = [
    {
      key: "name",
      header: t("catalog.common.name"),
      render: (row) => (
        <div className="flex max-w-[22rem] flex-col whitespace-normal wide-plus:max-w-[28rem]">
          <span className="flex items-start gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(row)}
              className="line-clamp-2 text-left font-medium text-on-surface hover:text-primary hover:underline"
              title={row.name}
            >
              {row.name}
            </button>
            {row.archivedAt && <Badge className="shrink-0">{t("catalog.common.archived")}</Badge>}
          </span>
          {row.description && (
            <span className="truncate text-[12.5px] text-on-surface-muted" title={row.description}>
              {row.description}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.name.toLowerCase(),
    },
    {
      key: "category",
      header: t("catalog.common.category"),
      render: (row) => row.category ?? "—",
      sortValue: (row) => row.category ?? "",
    },
    {
      key: "unit",
      header: t("catalog.table.unit"),
      render: (row) => row.unit,
    },
    {
      key: "hsnSac",
      header: t("catalog.table.hsnSac"),
      render: (row) => <span className={cn("tabular-nums", !row.hsnSac && "text-on-surface-muted")}>{row.hsnSac ?? "—"}</span>,
      sortValue: (row) => row.hsnSac ?? "",
    },
    {
      key: "defaultPrice",
      header: t("catalog.table.defaultPrice"),
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.defaultPriceAmount), row.defaultPriceCurrency)}</span>,
      sortValue: (row) => BigInt(row.defaultPriceAmount),
    },
    {
      key: "tax",
      header: t("catalog.common.tax"),
      render: (row) => {
        const label = taxLabel(row, rates, groups, gst);
        if (label.kind === "none") {
          return (
            <span className="inline-flex items-center gap-1 font-medium text-due-soon" data-testid="catalog-no-tax">
              <TriangleAlert size={14} aria-hidden />
              {label.text}
            </span>
          );
        }
        return <span className={cn(label.kind === "class" && "text-on-surface-muted")}>{label.text}</span>;
      },
      sortValue: (row) => taxLabel(row, rates, groups, gst).text,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <CatalogRowActions item={row} onEdit={onEdit} onDuplicate={onDuplicate} onChanged={onChanged} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      key={gst ? "gst" : "plain"}
      columns={columns}
      data={items}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={(row) => row.name}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      defaultHidden={gst ? [] : ["hsnSac"]}
    />
  );
}
