import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors ReceivablesTable's own columns — see invoices-skeleton.tsx's identical precedent for why this stays in sync by hand. */
const TABLE_COLUMNS = [
  { key: "number", header: "Invoice", width: "w-20" },
  { key: "contact", header: "Contact", width: "w-32" },
  { key: "dueDate", header: "Due date", width: "w-24" },
  { key: "bucket", header: "Aging", width: "w-20" },
  { key: "balanceDue", header: "Balance due", width: "w-24" },
];

export function ReceivablesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
