import { Textarea } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function TextareaPage() {
  return (
    <div>
      <DocTitle>Textarea</DocTitle>
      <DocLead>A multi-line text field — quote terms, job notes, expense descriptions.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Renders a native <textarea>, so rows, maxLength, and other native attributes pass through.",
            "Shares Input's border, radius, and focus-ring treatment so the two feel like one family in a form.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Textarea } from "@spine/ui";

export default () => <Textarea placeholder="Payment due within 14 days of invoice date." />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "…", type: "standard <textarea> attributes" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Textarea placeholder="Payment due within 14 days of invoice date." />`}>
          <Textarea placeholder="Payment due within 14 days of invoice date." className="w-80" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Pair with a FormField for a proper label, the same as Input.</DocLead>
      </DocSection>
    </div>
  );
}
