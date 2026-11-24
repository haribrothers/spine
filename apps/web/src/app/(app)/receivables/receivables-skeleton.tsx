import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors ReceivablesTable's own columns — see invoices-skeleton.tsx's identical precedent for why this stays in sync by hand. */
const TABLE_COLUMNS = [
  { key: "number", header: t("receivables.columns.invoice"), width: "w-20" },
  { key: "contact", header: t("receivables.columns.contact"), width: "w-32" },
  { key: "dueDate", header: t("receivables.columns.dueDate"), width: "w-24" },
  { key: "bucket", header: t("receivables.columns.aging"), width: "w-20" },
  { key: "balanceDue", header: t("receivables.columns.balanceDue"), width: "w-24" },
];

export function ReceivablesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
