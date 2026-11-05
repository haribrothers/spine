import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors QuotesTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: t("quotes.table.number"), width: "w-20" },
  { key: "contact", header: t("quotes.table.contact"), width: "w-32" },
  { key: "status", header: t("quotes.table.status"), width: "w-20" },
  { key: "validUntil", header: t("quotes.table.validUntil"), width: "w-24" },
  { key: "total", header: t("quotes.table.total"), width: "w-24" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like QuotesTable's actual columns. */
export function QuotesSkeleton() {
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
