import { Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function InputPage() {
  return (
    <div>
      <DocTitle>Input</DocTitle>
      <DocLead>
        A single-line text field. 40px height, 6px radius, clear label above via FormField —
        never placeholder-only.
      </DocLead>

      <ComponentPreview>
        <Input placeholder="Acme Contracting Ltd." className="w-64" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Renders a native <input>, so all native attributes (type, autoComplete, pattern, …) pass through.",
            "An error prop switches the border to the overdue color, paired with FormField's inline error text.",
            "Consistent 40px height across every text-style field in the library (Input, Select, DatePicker trigger, Combobox trigger).",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Input } from "@spine/ui";

export default () => <Input placeholder="Acme Contracting Ltd." />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "…", type: "standard <input> attributes" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Input placeholder="Acme Contracting Ltd." />`}>
          <Input placeholder="Acme Contracting Ltd." className="w-64" />
        </ComponentPreview>

        <DocLead>Error</DocLead>
        <ComponentPreview code={`<Input error defaultValue="not-an-email" />`}>
          <Input error defaultValue="not-an-email" className="w-64" />
        </ComponentPreview>

        <DocLead>Disabled</DocLead>
        <ComponentPreview code={`<Input disabled placeholder="Read only" />`}>
          <Input disabled placeholder="Read only" className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Always pair with a FormField (or a standalone Label) rather than relying on a
          placeholder alone — placeholder text disappears once a value is entered and is not a
          reliable substitute for a label with assistive technology.
        </DocLead>
      </DocSection>
    </div>
  );
}
