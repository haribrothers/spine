import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors CatalogTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "name", header: "Name", width: "w-40" },
  { key: "category", header: "Category", width: "w-24" },
  { key: "unit", header: "Unit", width: "w-16" },
  { key: "defaultPrice", header: "Default price", width: "w-28" },
  { key: "tax", header: "Tax", width: "w-12" },
  { key: "status", header: "Status", width: "w-16" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like CatalogTable's actual columns. */
export function CatalogSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-24" />
      </div>
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
