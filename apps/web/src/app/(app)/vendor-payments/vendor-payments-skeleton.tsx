import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors VendorPaymentsTable's own `columns` (header text, order) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: t("vendorPayments.columns.number"), width: "w-24" },
  { key: "date", header: t("vendorPayments.columns.date"), width: "w-24" },
  { key: "contact", header: t("vendorPayments.columns.vendor"), width: "w-40" },
  { key: "method", header: t("vendorPayments.columns.method"), width: "w-28" },
  { key: "amount", header: t("vendorPayments.columns.amount"), width: "w-24" },
];

/** Loading placeholder shaped like VendorPaymentsTable's actual columns. */
export function VendorPaymentsSkeleton() {
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
