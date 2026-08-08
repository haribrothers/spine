import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors QuotesTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: "Number", width: "w-20" },
  { key: "contact", header: "Contact", width: "w-32" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "validUntil", header: "Valid until", width: "w-24" },
  { key: "total", header: "Total", width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like QuotesTable's actual columns. */
export function QuotesSkeleton() {
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
