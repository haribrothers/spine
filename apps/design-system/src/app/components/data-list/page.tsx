import { DataList } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function DataListPage() {
  return (
    <div>
      <DocTitle>DataList</DocTitle>
      <DocLead>
        Label-to-value rows for a single record's detail view — lighter-weight than a full
        Table for one record rather than a collection.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Renders as a definition list (<dl>) with a divider between rows.", "The value slot accepts any node, not just text."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { DataList } from "@spine/ui";

export default () => <DataList items={[{ label: "Contact", value: "Acme Contracting Ltd." }]} />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "items", type: "{ label: string; value: ReactNode }[]" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<DataList
  items={[
    { label: "Contact", value: "Acme Contracting Ltd." },
    { label: "Issue date", value: "5 Aug 2026" },
    { label: "Due date", value: "19 Aug 2026" },
    { label: "Total", value: "$1,240.00" },
  ]}
/>`}
        >
          <DataList
            className="w-80"
            items={[
              { label: "Contact", value: "Acme Contracting Ltd." },
              { label: "Issue date", value: "5 Aug 2026" },
              { label: "Due date", value: "19 Aug 2026" },
              { label: "Total", value: "$1,240.00" },
            ]}
          />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Uses the semantic{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<dl>"}</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<dt>"}</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<dd>"}</code>{" "}
          elements so the label-value pairing is programmatically discoverable.
        </DocLead>
      </DocSection>
    </div>
  );
}
