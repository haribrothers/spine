"use client";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@spine/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const data = [
  { month: "Mar", revenue: 18400 },
  { month: "Apr", revenue: 21200 },
  { month: "May", revenue: 19800 },
  { month: "Jun", revenue: 24600 },
  { month: "Jul", revenue: 26100 },
  { month: "Aug", revenue: 23900 },
];

const config: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--color-primary)" },
};

export default function ChartPage() {
  return (
    <div>
      <DocTitle>Chart</DocTitle>
      <DocLead>
        A thin theming wrapper around Recharts. Categorical series default to the primary color
        plus muted greys; a chart displaying financial status (e.g. revenue by status) should
        pass explicit paid/due-soon/overdue colors instead — never mix the two palettes in the
        same chart.
      </DocLead>

      <ComponentPreview>
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "ChartContainer injects per-series CSS custom properties from a ChartConfig, so series color is data, not a hardcoded style prop.",
            "ChartTooltipContent renders a token-styled tooltip in place of Recharts' default.",
            "Works with any Recharts chart type (Bar, Line, Area, Pie, …) — ChartContainer just wraps ResponsiveContainer.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@spine/ui";
import { BarChart, Bar, XAxis, CartesianGrid } from "recharts";

const config: ChartConfig = { revenue: { label: "Revenue", color: "var(--color-primary)" } };

export default () => (
  <ChartContainer config={config}>
    <BarChart data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
    </BarChart>
  </ChartContainer>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "ChartContainer.config", type: "Record<string, { label?: ReactNode; color?: string }>" },
            { prop: "ChartTooltipContent", type: "drop-in replacement for Recharts' Tooltip content prop" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Bar chart</DocLead>
        <ComponentPreview
          code={`<ChartContainer config={config} className="h-64">
  <BarChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
  </BarChart>
</ChartContainer>`}
        >
          <ChartContainer config={config} className="h-64 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Charts are inherently visual — pair with an adjacent data table or a text summary
          (e.g. via DataList) for the same figures, so the information isn't chart-only.
        </DocLead>
      </DocSection>
    </div>
  );
}
