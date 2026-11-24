import { TableSkeleton } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const DEMO_COLUMNS = [
  { key: "number", header: "Invoice", width: "w-24" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "total", header: "Total", align: "right" as const, width: "w-20" },
  { key: "status", header: "Status", width: "w-16" },
];

export default function TableSkeletonPage() {
  return (
    <div>
      <DocTitle>TableSkeleton</DocTitle>
      <DocLead>
        A loading placeholder shaped like Table/DataTable&apos;s actual rendered output — the same
        column headers and alignment as the real table, not a generic set of bars — so a page
        doesn&apos;t visibly reflow once data arrives. Pass the same columns (header text, order,
        alignment) used for the live Table/DataTable so the two never drift apart.
      </DocLead>

      <ComponentPreview>
        <TableSkeleton columns={DEMO_COLUMNS} rows={4} />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={["Under 768px it shows placeholder rows (US-OPS-56).", 
            "Renders the real <thead> with the given columns' header text and alignment, not a placeholder bar.",
            "Body rows are Skeleton bars, one per column, respecting each column's align and optional width.",
            "rows controls how many placeholder rows render (defaults to 8).",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { TableSkeleton } from "@spine/ui";

const columns = [
  { key: "name", header: "Name", width: "w-40" },
  { key: "status", header: "Status", align: "right", width: "w-16" },
];

export default () => <TableSkeleton columns={columns} rows={6} />;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "columns", type: "TableSkeletonColumn[]" },
            { prop: "rows", type: "number", defaultValue: "8" },
          ]}
          caption="TableSkeletonColumn"
        />
        <ApiTable
          rows={[
            { prop: "key", type: "string" },
            { prop: "header", type: "string" },
            { prop: "align", type: "left | right", defaultValue: "left" },
            { prop: "width", type: "string", defaultValue: '"w-24"' },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Matching a live Table&apos;s columns</DocLead>
        <ComponentPreview
          code={`const columns = [
  { key: "number", header: "Invoice", width: "w-24" },
  { key: "contact", header: "Contact", width: "w-40" },
  { key: "total", header: "Total", align: "right", width: "w-20" },
  { key: "status", header: "Status", width: "w-16" },
];

<TableSkeleton columns={columns} rows={4} />`}
        >
          <TableSkeleton columns={DEMO_COLUMNS} rows={4} />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Purely visual — pair with an{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-busy</code>{" "}
          region or a visually-hidden &quot;Loading&quot; label where the loading state matters.
        </DocLead>
      </DocSection>
    </div>
  );
}
