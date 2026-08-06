import { Skeleton } from "@spine/ui";

/** Loading placeholder shaped like the table, matching contacts-skeleton.tsx's "list" branch. */
export function CatalogSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64" />
      <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-2 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
