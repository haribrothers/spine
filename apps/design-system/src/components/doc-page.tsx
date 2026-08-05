export function DocTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 id="top" className="mb-4 mt-0 text-[28px] font-bold tracking-tight text-on-surface">
      {children}
    </h1>
  );
}

export function DocLead({ children }: { children: React.ReactNode }) {
  return <p className="my-4 text-[14px] leading-relaxed text-on-surface">{children}</p>;
}

export function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-[20px] font-semibold tracking-tight text-on-surface">
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface ApiRow {
  prop: string;
  type: string;
  defaultValue?: string;
}

export function ApiTable({ rows }: { rows: ApiRow[] }) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            <th className="px-4 py-2 font-medium text-on-surface-muted">Prop</th>
            <th className="px-4 py-2 font-medium text-on-surface-muted">Type</th>
            <th className="px-4 py-2 font-medium text-on-surface-muted">Default</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.prop} className={index < rows.length - 1 ? "border-b border-border" : undefined}>
              <td className="px-4 py-2 font-mono text-[12.5px]">{row.prop}</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">{row.type}</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">{row.defaultValue ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
