import { Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { ApiTable, DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function InputPage() {
  return (
    <div>
      <DocTitle>Input</DocTitle>
      <DocLead>
        A single-line text field. 40px height, 6px radius, clear label above via FormField —
        never placeholder-only.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview code={`<Input placeholder="Acme Contracting Ltd." />`}>
          <Input placeholder="Acme Contracting Ltd." className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="error" title="Error">
        <ComponentPreview code={`<Input error defaultValue="not-an-email" />`}>
          <Input error defaultValue="not-an-email" className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="disabled" title="Disabled">
        <ComponentPreview code={`<Input disabled placeholder="Read only" />`}>
          <Input disabled placeholder="Read only" className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="api" title="API">
        <ApiTable
          rows={[
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "…", type: "standard <input> attributes" },
          ]}
        />
      </DocSection>
    </div>
  );
}
