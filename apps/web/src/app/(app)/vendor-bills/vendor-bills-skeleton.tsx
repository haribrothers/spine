import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors VendorBillsTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "billNumber", header: t("vendorBills.skeleton.billNumber"), width: "w-24" },
  { key: "contact", header: t("vendorBills.skeleton.vendor"), width: "w-32" },
  { key: "status", header: t("vendorBills.skeleton.status"), width: "w-20" },
  { key: "dueDate", header: t("vendorBills.skeleton.dueDate"), width: "w-24" },
  { key: "total", header: t("vendorBills.skeleton.total"), width: "w-24" },
  { key: "balanceDue", header: t("vendorBills.skeleton.balanceDue"), width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like VendorBillsTable's actual columns. */
export function VendorBillsSkeleton() {
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
