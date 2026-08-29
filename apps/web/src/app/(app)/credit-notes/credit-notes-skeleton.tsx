import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors CreditNotesTable's own `columns` (header text, order) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: "Number", width: "w-24" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "date", header: "Date", width: "w-24" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "invoice", header: "Invoice", width: "w-24" },
  { key: "total", header: "Total", width: "w-24" },
];

/** Loading placeholder shaped like CreditNotesTable's actual columns. */
export function CreditNotesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
