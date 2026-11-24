export function ColorSwatch({ name, variable }: { name: string; variable: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div
        className="h-10 w-10 shrink-0 rounded-md border border-border"
        style={{ background: `var(${variable})` }}
      />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-on-surface">{name}</div>
        <div className="truncate font-mono text-[11px] text-on-surface-muted">{variable}</div>
      </div>
    </div>
  );
}

export function ColorSwatchGrid({
  swatches,
}: {
  swatches: { name: string; variable: string }[];
}) {
  return (
    <div className="my-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {swatches.map((swatch) => (
        <ColorSwatch key={swatch.variable} {...swatch} />
      ))}
    </div>
  );
}
