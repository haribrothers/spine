import { cn } from "../lib/cn";

export interface DataListItem {
  label: string;
  value: React.ReactNode;
}

/** Label-to-value rows for a single record's detail view — lighter-weight than a Table for one record, per §F0. */
export function DataList({ items, className }: { items: DataListItem[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
          <dt className="text-on-surface-muted">{item.label}</dt>
          <dd className="font-medium text-on-surface">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
