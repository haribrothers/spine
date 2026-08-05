import { DataList } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function DataListPage() {
  return (
    <div>
      <DocTitle>DataList</DocTitle>
      <DocLead>
        Label-to-value rows for a single record's detail view — lighter-weight than a full
        Table for one record rather than a collection.
      </DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
