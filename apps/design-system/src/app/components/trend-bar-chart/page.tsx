"use client";

import { TrendBarChart } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const vertical = [
  { key: "mar", label: "Mar", value: 18400, formattedValue: "$18,400.00" },
  { key: "apr", label: "Apr", value: 21200, formattedValue: "$21,200.00" },
  { key: "may", label: "May", value: 0, formattedValue: "$0.00" },
  { key: "jun", label: "Jun", value: 24600, formattedValue: "$24,600.00" },
];

const horizontal = [
  { key: "new", label: "New", value: 6960, formattedValue: "$6,960.00 · 2" },
  { key: "qualified", label: "Qualified", value: 68210, formattedValue: "$68,210.00 · 8" },
  { key: "proposal", label: "Proposal", value: 109900, formattedValue: "$109,900.00 · 4" },
  { key: "won", label: "Won", value: 0, formattedValue: "$0.00 · 0" },
];

export default function TrendBarChartPage() {
  return (
    <div>
      <DocTitle>TrendBarChart</DocTitle>
      <DocLead>
        A single-series bar chart with real value labels and a real empty state — the two things a bare Recharts{" "}
        <code>BarChart</code> inside <code>ChartContainer</code> doesn&apos;t give you for free, and both matter more
        on a small dashboard card than a full report page (a 12-bar chart with 11 empty months and no labels reads as
        broken, not quiet). Extracted from the dashboard&apos;s revenue trend and pipeline-by-stage widgets.
      </DocLead>

      <ComponentPreview>
        <TrendBarChart data={vertical} className="w-full max-w-lg" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Vertical orientation (bars grow up, category axis along the bottom) for a time trend, or horizontal (bars grow right, category axis on the left) for a ranked/categorical breakdown.",
            "Every non-zero bar gets a value label — zero-value points show a quiet \"—\" instead of a label-less sliver.",
            "A real empty state (emptyState prop) when every point is 0, instead of an axis with nothing on it.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { TrendBarChart } from "@spine/ui";

const data = [
  { key: "mar", label: "Mar", value: 18400, formattedValue: "$18,400.00" },
  { key: "apr", label: "Apr", value: 21200, formattedValue: "$21,200.00" },
];

export default () => (
  <TrendBarChart data={data} emptyState="No revenue posted in this range yet." />
);`}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Horizontal (ranked breakdown)</DocLead>
        <ComponentPreview
          code={`<TrendBarChart data={data} orientation="horizontal" emptyState="No leads yet." />`}
        >
          <TrendBarChart data={horizontal} orientation="horizontal" className="w-full max-w-lg" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "data", type: "TrendBarChartPoint[]", description: "{ key, label, value, formattedValue }" },
            { prop: "orientation", type: '"vertical" | "horizontal"', description: "Default: vertical." },
            { prop: "color", type: "string", description: "Bar fill. Default: var(--color-primary)." },
            { prop: "emptyState", type: "ReactNode", description: 'Shown when every point is 0. Default: "No data yet."' },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Charts are inherently visual — pair with an adjacent data table or a text summary for the same figures,
          same guidance as <code>Chart</code> itself.
        </DocLead>
      </DocSection>
    </div>
  );
}
