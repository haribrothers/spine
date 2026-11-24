"use client";

import { PaginationBar } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function PaginationBarDemo() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  return (
    <PaginationBar
      page={page}
      pageSize={pageSize}
      total={238}
      onPageChange={setPage}
      onPageSizeChange={(next) => {
        setPageSize(next);
        setPage(1);
      }}
    />
  );
}

export default function PaginationBarPage() {
  return (
    <div>
      <DocTitle>PaginationBar</DocTitle>
      <DocLead>
        Pairs a rows-per-page select with Pagination and an &quot;x–y of n&quot; summary — the
        configurable list-page footer for any screen that fetches its full result set and
        paginates client-side, such as Contacts and Catalogue. Table also renders this
        internally when given <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">configurablePageSize</code>.
      </DocLead>

      <ComponentPreview>
        <PaginationBarDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Rows-per-page <select>, defaulting to 10/25/50/100 (override via pageSizeOptions).",
            "\"x–y of n\" summary reflecting the current page and page size.",
            "Hides the Pagination control entirely when everything fits on one page.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { PaginationBar } from "@spine/ui";

const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

<PaginationBar
  page={page}
  pageSize={pageSize}
  total={rows.length}
  onPageChange={setPage}
  onPageSizeChange={(next) => {
    setPageSize(next);
    setPage(1);
  }}
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "page", type: "number" },
            { prop: "pageSize", type: "number" },
            { prop: "pageSizeOptions", type: "number[]", defaultValue: "[10, 25, 50, 100]" },
            { prop: "total", type: "number" },
            { prop: "onPageChange", type: "(page: number) => void" },
            { prop: "onPageSizeChange", type: "(pageSize: number) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

<PaginationBar
  page={page}
  pageSize={pageSize}
  total={238}
  onPageChange={setPage}
  onPageSizeChange={(next) => {
    setPageSize(next);
    setPage(1);
  }}
/>`}
        >
          <PaginationBarDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="printing" title="Printing">
        <DocLead>Left out of print (<code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">data-print="hide"</code>), like Pagination.</DocLead>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The rows-per-page control is a native{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<select>"}</code>{" "}
          with an associated (visually hidden) label. Pagination itself follows its own
          accessibility notes — a <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{'<nav aria-label="Pagination">'}</code> landmark with{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-current=&quot;page&quot;</code> on the active page.
        </DocLead>
      </DocSection>
    </div>
  );
}
