"use client";

import { Pagination } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

function PaginationDemo() {
  const [page, setPage] = useState(3);
  return <Pagination page={page} pageCount={12} onPageChange={setPage} />;
}

export default function PaginationPage() {
  return (
    <div>
      <DocTitle>Pagination</DocTitle>
      <DocLead>Numbered + prev/next, current page in a filled primary-colored pill.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`const [page, setPage] = useState(3);

<Pagination page={page} pageCount={12} onPageChange={setPage} />`}
        >
          <PaginationDemo />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
