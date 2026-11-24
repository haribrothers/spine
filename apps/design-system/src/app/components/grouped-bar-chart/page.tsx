"use client";

import { GroupedBarChart, type GroupedBarChartRow } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const series = [
  { key: "contract", label: "Contract value", color: "var(--color-on-surface-muted)" },
  { key: "billed", label: "Billed to date", color: "var(--color-primary)" },
  { key: "cost", label: "Cost", color: "var(--color-due-soon)" },
];

const data: GroupedBarChartRow[] = [
  { key: "warehouse", label: "Warehouse slab & canopy", contract: 86000, billed: 21500, cost: 27520, budget: 32000 },
  { key: "marina", label: "Marina office fit-out", contract: 48500, billed: 19400, cost: 24800, budget: 32000 },
  { key: "hotel", label: "Hotel lobby renovation", contract: 21000, billed: 0, cost: 0, budget: null },
  { key: "phase2", label: "Phase 2 townhomes", contract: 12500, billed: 8750, cost: 7980, budget: 7700 },
];

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const tooltip = (row: GroupedBarChartRow) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-semibold">{row.label}</span>
    <span>Contract value {money(Number(row.contract))}</span>
    <span>Billed to date {money(Number(row.billed))}</span>
    <span>Cost {money(Number(row.cost))}</span>
  </div>
);

export default function GroupedBarChartPage() {
  return (
    <div>
      <DocTitle>GroupedBarChart</DocTitle>
      <DocLead>
        Several series side by side for each category — e.g. each job&apos;s contract value, billed to date and cost — with a text legend and an optional dashed
        marker over one series, such as a budget over cost.
      </DocLead>

      <ComponentPreview>
        <GroupedBarChart
          data={data}
          series={series}
          marker={{ key: "budget", label: "Cost budget", seriesKey: "cost" }}
          formatTick={(v) => `$${Math.round(v / 1000)}k`}
          renderTooltip={tooltip}
          aria-label="Contract, billed and cost by job"
          description="The table below lists every job."
          className="w-full"
        />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A legend in text for every series and the marker — colour is never the only signal.",
            "US-RPT-41: under 768px the legend sits under the chart, only some labels show on the x-axis so they don't overlap, and the y-axis is narrower.",
            "A dashed marker drawn across one series' bar at its own value (rows without it show none).",
            "A tooltip whose content you write, on hover and keyboard focus.",
            "An empty state when every value is zero.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { GroupedBarChart } from "@spine/ui";

<GroupedBarChart
  data={rows}
  series={[{ key: "contract", label: "Contract value", color: "var(--color-on-surface-muted)" }, …]}
  marker={{ key: "budget", label: "Cost budget", seriesKey: "cost" }}
  formatTick={(v) => \`$\${Math.round(v / 1000)}k\`}
  renderTooltip={(row) => …}
  aria-label="Contract, billed and cost by job"
  description="The table below lists every job."
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "data", type: "GroupedBarChartRow[]", description: "{ key, label, …one number per series and marker }" },
            { prop: "series", type: "GroupedBarChartSeries[]", description: "{ key, label, color } — colours from theme tokens." },
            { prop: "marker", type: "GroupedBarChartMarker", description: "{ key, label, seriesKey } — optional dashed line over a series' bar." },
            { prop: "formatTick", type: "(value: number) => string", description: "Y-axis tick text." },
            { prop: "renderTooltip", type: "(row) => ReactNode", description: "The tooltip body for a category." },
            { prop: "aria-label", type: "string", description: "Names the chart for screen readers." },
            { prop: "description", type: "string", description: "Where the same figures are in text (e.g. the table below)." },
            { prop: "emptyState", type: "ReactNode", description: 'Shown when every value is 0. Default: "No data."' },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The plot is a labelled image whose description points to the table holding the same figures; the legend names every series and the marker in
          text, so nothing depends on colour alone.
        </DocLead>
      </DocSection>
    </div>
  );
}
