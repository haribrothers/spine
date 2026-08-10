import { Skeleton, TableSkeleton } from "@spine/ui";

/** Mirrors JobsTable's own `columns` — see invoices/invoices-skeleton.tsx's identical precedent. */
const TABLE_COLUMNS = [
  { key: "name", header: "Job", width: "w-32" },
  { key: "contact", header: "Contact", width: "w-32" },
  { key: "status", header: "Status", width: "w-20" },
  { key: "contractValue", header: "Contract value", width: "w-24" },
  { key: "retentionPct", header: "Retention", width: "w-16" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
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
