import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors PaymentsTable's own `columns` (header text, order) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: "Number", width: "w-24" },
  { key: "date", header: "Date", width: "w-24" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "method", header: "Method", width: "w-28" },
  { key: "amount", header: "Amount", width: "w-24" },
  { key: "unallocated", header: "Unallocated", width: "w-28" },
];

/** Loading placeholder shaped like PaymentsTable's actual columns. */
export function PaymentsSkeleton() {
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
