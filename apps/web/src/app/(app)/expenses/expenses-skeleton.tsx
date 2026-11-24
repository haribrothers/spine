import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors ExpensesTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "date", header: t("expenses.columns.date"), width: "w-24" },
  { key: "category", header: t("expenses.columns.category"), width: "w-28" },
  { key: "job", header: t("expenses.columns.job"), width: "w-28" },
  { key: "amount", header: t("expenses.columns.amount"), width: "w-24" },
  { key: "status", header: t("expenses.columns.status"), width: "w-20" },
  { key: "submittedBy", header: t("expenses.columns.submittedBy"), width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like ExpensesTable's actual columns. */
export function ExpensesSkeleton() {
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
