import { Card, Skeleton, TableSkeleton } from "@spine/ui";
import type { ContactView } from "./contacts-view-switcher";
import { t } from "../../../lib/i18n";

/** Mirrors ContactsTable's own `columns` (header text, order, alignment) so the loading state never drifts out of sync with the real table. */
const TABLE_COLUMNS = [
  { key: "name", header: t("contacts.common.name"), width: "w-40" },
  { key: "type", header: t("contacts.common.type"), width: "w-20" },
  { key: "email", header: t("contacts.common.email"), width: "w-48" },
  { key: "phone", header: t("contacts.common.phone"), width: "w-28" },
  { key: "status", header: t("contacts.common.status"), width: "w-16" },
  { key: "actions", header: "", width: "w-6", align: "right" as const },
];

/** Loading placeholders shaped like the view currently selected, replacing the old full-page `<Spinner />`. */
export function ContactsSkeleton({ view }: { view: ContactView }) {
  if (view === "card") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
