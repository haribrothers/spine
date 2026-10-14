import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors JobsTable's own `columns` — see invoices/invoices-skeleton.tsx's identical precedent. */
const TABLE_COLUMNS = [
  { key: "name", header: "Job", width: "w-40" },
  { key: "contact", header: "Contact", width: "w-32" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "next", header: "Next milestone", width: "w-28" },
  { key: "progress", header: "Progress", width: "w-28" },
  { key: "endDate", header: "End date", width: "w-20" },
  { key: "contractValue", header: "Contract", width: "w-24", align: "right" as const },
];

export function JobsSkeleton() {
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
