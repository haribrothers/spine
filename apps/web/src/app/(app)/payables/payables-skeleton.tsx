import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors PayablesTable's own columns — see receivables-skeleton.tsx's identical precedent for why this stays in sync by hand. */
const TABLE_COLUMNS = [
  { key: "billNumber", header: "Bill", width: "w-20" },
  { key: "contact", header: "Vendor", width: "w-32" },
  { key: "dueDate", header: "Due date", width: "w-24" },
  { key: "bucket", header: "Aging", width: "w-20" },
  { key: "balanceDue", header: "Balance due", width: "w-24" },
];

export function PayablesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
