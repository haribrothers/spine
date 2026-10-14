/** A Your account pane's title and what it's for (US-SET-30). */
export function AccountPaneHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pr-8">
      <h2 className="text-[17px] font-semibold text-on-surface">{title}</h2>
      <p className="mt-1 text-[13.5px] text-on-surface-muted">{description}</p>
    </div>
  );
}

/** One titled card in a Your account pane. */
export function AccountCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-semibold text-on-surface">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-on-surface-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
