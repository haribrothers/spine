import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors CreditNotesTable's own `columns` (header text, order) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "number", header: t("creditNotes.columns.number"), width: "w-24" },
  { key: "status", header: t("creditNotes.columns.status"), width: "w-20" },
  { key: "date", header: t("creditNotes.columns.date"), width: "w-24" },
  { key: "contact", header: t("creditNotes.columns.contact"), width: "w-40" },
  { key: "invoice", header: t("creditNotes.columns.invoice"), width: "w-24" },
  { key: "total", header: t("creditNotes.columns.total"), width: "w-24" },
];

/** Loading placeholder shaped like CreditNotesTable's actual columns. */
export function CreditNotesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <TableSkeleton columns={TABLE_COLUMNS} />
    </div>
  );
}
