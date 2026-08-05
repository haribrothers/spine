import { StatCard } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function StatCardPage() {
  return (
    <div>
      <DocTitle>StatCard</DocTitle>
      <DocLead>A Card variant for a single dashboard KPI — cash position, receivables, overdue count.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["An optional trend indicator colors green/red/neutral by direction, independent of financial-status semantics."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { StatCard } from "@spine/ui";

export default () => <StatCard label="Cash position" value="$48,210" />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "label", type: "string" },
            { prop: "value", type: "string" },
            { prop: "trend", type: "{ direction: 'up' | 'down' | 'neutral'; label: string }" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<StatCard label="Cash position" value="$48,210" trend={{ direction: "up", label: "+12% vs last month" }} />`}>
          <StatCard label="Cash position" value="$48,210" trend={{ direction: "up", label: "+12% vs last month" }} className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>A plain display container — no interactive semantics.</DocLead>
      </DocSection>
    </div>
  );
}
