import { FilterSheet, Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function FilterSheetPage() {
  return (
    <div>
      <DocTitle>FilterSheet</DocTitle>
      <DocLead>A list&apos;s filters: inline from 768px up; on a phone, search and a Filters button in one row, a chip for each filter that&apos;s on, and a sheet with every filter (US-OPS-57).</DocLead>

      <ComponentPreview>
        <FilterSheet className="flex gap-2" chips={[]}>
          <Input aria-label="Status" placeholder="Status" className="w-40" />
          <Input aria-label="Contact" placeholder="All contacts" className="w-56" />
        </FilterSheet>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={["The Filters button shows how many filters are on.", "Each chip has × to remove its filter.", "The sheet has every filter and the sort, Clear all and Show results.", "Resize below 768px to see the phone row."]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<FilterSheet search={isPhone ? search : undefined} chips={chips} onClearAll={clearAll}>{controls}</FilterSheet>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "search", type: "ReactNode" },
            { prop: "chips", type: "{ key, label, onRemove }[]" },
            { prop: "onClearAll", type: "() => void" },
            { prop: "showLabel", type: "string" },
            { prop: "className", type: "string — the desktop row" },
          ]}
        />
      </DocSection>
    </div>
  );
}
