import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors JobsTable's own `columns` — see invoices/invoices-skeleton.tsx's identical precedent. */
const TABLE_COLUMNS = [
  { key: "name", header: t("jobs.table.job"), width: "w-40" },
  { key: "contact", header: t("jobs.table.contact"), width: "w-32" },
  { key: "status", header: t("jobs.table.status"), width: "w-20" },
  { key: "next", header: t("jobs.table.nextMilestone"), width: "w-28" },
  { key: "progress", header: t("jobs.table.progress"), width: "w-28" },
  { key: "endDate", header: t("jobs.table.endDate"), width: "w-20" },
  { key: "contractValue", header: t("jobs.table.contract"), width: "w-24", align: "right" as const },
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
