import { ChipStrip, StatCard } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ChipStripPage() {
  return (
    <div>
      <DocTitle>ChipStrip</DocTitle>
      <DocLead>A list&apos;s summary cards: a grid from 768px up, compact chips in one row that scrolls sideways on a phone (US-OPS-57, D-283).</DocLead>

      <ComponentPreview>
        <ChipStrip label="Invoice totals" className="grid w-full grid-cols-2 gap-4">
          <StatCard label="Outstanding" value="$31,228.00" detail="7 invoices" />
          <StatCard label="Overdue" value="$4,542.50" detail="1 invoice" tone="critical" />
        </ChipStrip>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Keeps the page's own layout from 768px up.", "On a phone each StatCard shows its label and figure only; a card that filters still filters.", "CSS only: it works server-rendered."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<ChipStrip className="grid grid-cols-4 gap-4">{cards}</ChipStrip>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "label", type: "string" }, { prop: "className", type: "string — the desktop layout" }]} />
      </DocSection>
    </div>
  );
}
