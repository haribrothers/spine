import { Textarea } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { ApiTable, DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function TextareaPage() {
  return (
    <div>
      <DocTitle>Textarea</DocTitle>
      <DocLead>A multi-line text field — quote terms, job notes, expense descriptions.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview code={`<Textarea placeholder="Payment due within 14 days of invoice date." />`}>
          <Textarea placeholder="Payment due within 14 days of invoice date." className="w-80" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="api" title="API">
        <ApiTable
          rows={[
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "…", type: "standard <textarea> attributes" },
          ]}
        />
      </DocSection>
    </div>
  );
}
