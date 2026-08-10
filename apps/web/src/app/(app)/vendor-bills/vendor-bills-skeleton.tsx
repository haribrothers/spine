import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors VendorBillsTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "billNumber", header: "Bill number", width: "w-24" },
  { key: "contact", header: "Vendor", width: "w-32" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "dueDate", header: "Due date", width: "w-24" },
  { key: "total", header: "Total", width: "w-24" },
  { key: "balanceDue", header: "Balance due", width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like VendorBillsTable's actual columns. */
export function VendorBillsSkeleton() {
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
