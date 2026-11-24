import { Progress } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ProgressPage() {
  return (
    <div>
      <DocTitle>Progress</DocTitle>
      <DocLead>
        Displays an indicator showing the completion progress of a task — e.g. "72% of matrix
        requirements met" or a job's cost-vs-budget. Primary-filled track.
      </DocLead>

      <ComponentPreview>
        <Progress value={72} className="w-64" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Provides context for screen reader users via aria-valuenow/aria-valuemax."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Progress } from "@spine/ui";

export default () => <Progress value={72} />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "number" },
            { prop: "max", type: "number", defaultValue: "100" },
            { prop: "tone", type: '"default" | "warning" | "danger" | "neutral"', defaultValue: '"default"' },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Progress value={72} className="w-64" />`}>
          <Progress value={72} className="w-64" />
        </ComponentPreview>
        <DocLead>Tones — a job nearing or over its budget, and a neutral second measure (work complete beside billed). Always pair a warning or danger tone with text and an icon; colour is never the only signal.</DocLead>
        <ComponentPreview
          code={`<Progress value={85} tone="warning" aria-label="Budget used" />
<Progress value={100} tone="danger" aria-label="Budget used" />
<Progress value={55} tone="neutral" aria-label="Work complete" />`}
        >
          <div className="flex w-64 flex-col gap-3">
            <Progress value={85} tone="warning" aria-label="Budget used" />
            <Progress value={100} tone="danger" aria-label="Budget used" />
            <Progress value={55} tone="neutral" aria-label="Work complete" />
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Exposes the value through ARIA's progressbar role, announced by screen readers as a percentage.</DocLead>
      </DocSection>
    </div>
  );
}
