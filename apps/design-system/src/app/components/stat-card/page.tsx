import { StatCard } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function StatCardPage() {
  return (
    <div>
      <DocTitle>StatCard</DocTitle>
      <DocLead>A Card variant for a single dashboard KPI — cash position, receivables, overdue count.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<StatCard label="Cash position" value="$48,210" trend={{ direction: "up", label: "+12% vs last month" }} />`}
        >
          <StatCard
            label="Cash position"
            value="$48,210"
            trend={{ direction: "up", label: "+12% vs last month" }}
            className="w-64"
          />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
