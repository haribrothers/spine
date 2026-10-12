import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors PayablesVendorsTable's own columns — see receivables-skeleton.tsx's identical precedent for why this stays in sync by hand. */
const TABLE_COLUMNS = [
  { key: "name", header: "Vendor", width: "w-32" },
  { key: "count", header: "Open", width: "w-16" },
  { key: "oldest", header: "Oldest", width: "w-24" },
  { key: "overdue", header: "Overdue", width: "w-24" },
  { key: "total", header: "Total owed", width: "w-24" },
];

export function PayablesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
