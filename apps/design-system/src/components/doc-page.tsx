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

export function DocSubsection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 id={id} className="mb-2 mt-6 scroll-mt-20 text-[15px] font-semibold text-on-surface">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** The Features section's bulleted capability list — matches the Radix Primitives docs pattern. */
export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="my-4 list-disc space-y-1.5 pl-5 text-[14px] text-on-surface">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export interface ApiRow {
  prop: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export function ApiTable({ rows, caption }: { rows: ApiRow[]; caption?: string }) {
  return (
    <div className="my-4">
      {caption && <p className="mb-2 text-[13px] font-medium text-on-surface">{caption}</p>}
      <div className="overflow-hidden rounded-lg border border-border">
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
    </div>
  );
}

export interface KeyboardRow {
  keys: string;
  description: string;
}

/** The Accessibility section's keyboard-interaction table. */
export function KeyboardTable({ rows }: { rows: KeyboardRow[] }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            <th className="w-40 px-4 py-2 font-medium text-on-surface-muted">Key</th>
            <th className="px-4 py-2 font-medium text-on-surface-muted">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.keys} className={index < rows.length - 1 ? "border-b border-border" : undefined}>
              <td className="px-4 py-2">
                {row.keys.split("+").map((key, i, arr) => (
                  <span key={key}>
                    <kbd className="rounded border border-border-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px]">
                      {key}
                    </kbd>
                    {i < arr.length - 1 && <span className="px-1 text-on-surface-muted">+</span>}
                  </span>
                ))}
              </td>
              <td className="px-4 py-2 text-on-surface-muted">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
