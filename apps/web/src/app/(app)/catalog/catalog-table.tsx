"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { CatalogRowActions } from "./catalog-row-actions";
import type { CatalogItem } from "./types";

/**
 * The (only) list view for Catalogue — a flat table, no card/list-view
 * switcher like Contacts, since PRD F2's scope is a simple CRUD list, not a
 * pipeline or relationship-heavy entity worth multiple visualizations.
 */
export function CatalogTable({
  items,
  onEdit,
  onChanged,
}: {
  items: CatalogItem[];
  onEdit: (item: CatalogItem) => void;
  onChanged: (action: "archived" | "restored" | "deleted", item: CatalogItem) => void;
}) {
  const columns: TableColumn<CatalogItem>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="text-left font-medium text-on-surface hover:text-primary hover:underline"
        >
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category ?? "—",
      sortValue: (row) => row.category ?? "",
    },
    {
      key: "unit",
      header: "Unit",
      render: (row) => row.unit,
    },
    {
      key: "defaultPrice",
      header: "Default price",
      render: (row) => (
        <span className="font-mono tabular-nums">
          {toDecimalString({ amount: BigInt(row.defaultPriceAmount), currency: row.defaultPriceCurrency })}{" "}
          {row.defaultPriceCurrency}
        </span>
      ),
      sortValue: (row) => Number(row.defaultPriceAmount),
    },
    {
      key: "tax",
      header: "Tax",
      render: (row) => `${row.defaultTaxRatePercentage}%`,
      sortValue: (row) => row.defaultTaxRatePercentage,
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.archivedAt ? (
          <Badge>Archived</Badge>
        ) : (
          <Badge className="bg-transparent text-on-surface-muted">Active</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <CatalogRowActions item={row} onEdit={onEdit} onChanged={onChanged} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={(row) => row.id}
      searchPlaceholder="Search items"
      searchKey={(row) => `${row.name} ${row.category ?? ""} ${row.unit}`}
      configurablePageSize
    />
  );
}
