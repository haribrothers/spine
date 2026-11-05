import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors PayablesVendorsTable's own columns — see receivables-skeleton.tsx's identical precedent for why this stays in sync by hand. */
const TABLE_COLUMNS = [
  { key: "name", header: t("payables.columns.vendor"), width: "w-32" },
  { key: "count", header: t("payables.columns.open"), width: "w-16" },
  { key: "oldest", header: t("payables.columns.oldest"), width: "w-24" },
  { key: "overdue", header: t("payables.columns.overdue"), width: "w-24" },
  { key: "total", header: t("payables.columns.totalOwed"), width: "w-24" },
];

export function PayablesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
