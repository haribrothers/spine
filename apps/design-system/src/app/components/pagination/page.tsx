"use client";

import { Pagination } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

function PaginationDemo() {
  const [page, setPage] = useState(3);
  return <Pagination page={page} pageCount={12} onPageChange={setPage} />;
}

export default function PaginationPage() {
  return (
    <div>
      <DocTitle>Pagination</DocTitle>
      <DocLead>Numbered + prev/next, current page in a filled primary-colored pill.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["A sliding window of page numbers centered on the current page.", "Prev/next buttons disable at the boundaries."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Pagination } from "@spine/ui";

export default () => <Pagination page={1} pageCount={10} onPageChange={setPage} />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "page", type: "number" },
            { prop: "pageCount", type: "number" },
            { prop: "onPageChange", type: "(page: number) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`const [page, setPage] = useState(3);

<Pagination page={page} pageCount={12} onPageChange={setPage} />`}
        >
          <PaginationDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Rendered inside a{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{'<nav aria-label="Pagination">'}</code>{" "}
          landmark; the current page uses{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-current=&quot;page&quot;</code>.
        </DocLead>
        <KeyboardTable rows={[{ keys: "Tab", description: "Moves focus between prev/next and page number buttons." }, { keys: "Enter", description: "Activates the focused button." }]} />
      </DocSection>
    </div>
  );
}
