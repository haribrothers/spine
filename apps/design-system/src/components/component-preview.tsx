import { CodeBlock } from "./code-block";

export function ComponentPreview({
  code,
  children,
}: {
  code: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-border">
      <div className="flex min-h-32 items-center justify-center bg-surface-sunken p-8">
        {children}
      </div>
      <div className="border-t border-border">
        <CodeBlock code={code} />
      </div>
    </div>
  );
}
