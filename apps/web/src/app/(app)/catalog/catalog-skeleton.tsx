import { Skeleton, TableSkeleton } from "@spine/ui";
import { t } from "../../../lib/i18n";

/** Mirrors CatalogTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "name", header: t("catalog.common.name"), width: "w-40" },
  { key: "category", header: t("catalog.common.category"), width: "w-24" },
  { key: "unit", header: t("catalog.table.unit"), width: "w-16" },
  { key: "defaultPrice", header: t("catalog.table.defaultPrice"), width: "w-28" },
  { key: "tax", header: t("catalog.common.tax"), width: "w-12" },
  { key: "status", header: t("catalog.common.status"), width: "w-16" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholder shaped like CatalogTable's actual columns. */
export function CatalogSkeleton() {
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
