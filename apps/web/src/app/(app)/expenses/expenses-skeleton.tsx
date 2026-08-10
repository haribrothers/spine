import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors ExpensesTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "date", header: "Date", width: "w-24" },
  { key: "category", header: "Category", width: "w-28" },
  { key: "job", header: "Job", width: "w-28" },
  { key: "amount", header: "Amount", width: "w-24" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "submittedBy", header: "Submitted by", width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like ExpensesTable's actual columns. */
export function ExpensesSkeleton() {
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
