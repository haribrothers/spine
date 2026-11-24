import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors InvoicesTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: t("invoices.columns.number"), width: "w-20" },
  { key: "contact", header: t("invoices.columns.contact"), width: "w-32" },
  { key: "status", header: t("invoices.columns.status"), width: "w-20" },
  { key: "dueDate", header: t("invoices.columns.dueDate"), width: "w-24" },
  { key: "total", header: t("invoices.columns.total"), width: "w-24" },
  { key: "balanceDue", header: t("invoices.columns.balanceDue"), width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like InvoicesTable's actual columns. */
export function InvoicesSkeleton() {
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
