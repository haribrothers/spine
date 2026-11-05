import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors PaymentsTable's own `columns` (header text, order) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: t("payments.columns.number"), width: "w-24" },
  { key: "date", header: t("payments.columns.date"), width: "w-24" },
  { key: "contact", header: t("payments.columns.customer"), width: "w-40" },
  { key: "method", header: t("payments.columns.method"), width: "w-28" },
  { key: "amount", header: t("payments.columns.amount"), width: "w-24" },
  { key: "applied", header: t("payments.columns.appliedTo"), width: "w-28" },
  { key: "credit", header: t("payments.columns.creditLeft"), width: "w-24" },
];

/** Loading placeholder shaped like PaymentsTable's actual columns. */
export function PaymentsSkeleton() {
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
