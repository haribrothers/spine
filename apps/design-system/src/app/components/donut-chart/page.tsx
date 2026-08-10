"use client";

import { DonutChart } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const segments = [
  { key: "current", label: "Current", value: 12400, color: "var(--color-paid)", formattedValue: "$12,400.00" },
  { key: "0-30", label: "1–30 days", value: 3200, color: "var(--color-due-soon)", formattedValue: "$3,200.00" },
  { key: "31-60", label: "31–60 days", value: 850, color: "var(--color-overdue)", formattedValue: "$850.00" },
];

export default function DonutChartPage() {
  return (
    <div>
      <DocTitle>DonutChart</DocTitle>
      <DocLead>
        A labeled donut chart — a Recharts pie inside <code>ChartContainer</code>, plus a real legend (label +
        formatted value per segment, not just a color swatch) and an optional center total. Extracted from the
        dashboard&apos;s AR aging widget so any future proportional breakdown (tax collected by rate, expense by
        category) reuses this instead of re-solving &quot;which color is which&quot; from scratch.
      </DocLead>

      <ComponentPreview>
        <DonutChart segments={segments} centerLabel="$16,450.00" className="w-full max-w-md" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Real legend — every segment shows its label and a pre-formatted value, not just a colored dot.",
            "Optional center label, typically a total.",
            "A real empty state (emptyState prop) instead of an empty ring when every segment is 0.",
            "Callers own their own segment colors — pass the semantic paid/due-soon/overdue tokens for a financial-status breakdown, the categorical accent for anything else. Never mix the two palettes in one chart.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { DonutChart } from "@spine/ui";

const segments = [
  { key: "current", label: "Current", value: 12400, color: "var(--color-paid)", formattedValue: "$12,400.00" },
  { key: "0-30", label: "1–30 days", value: 3200, color: "var(--color-due-soon)", formattedValue: "$3,200.00" },
];

export default () => (
  <DonutChart segments={segments} centerLabel="$15,600.00" emptyState="Nothing outstanding." />
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "segments", type: "DonutChartSegment[]", description: "{ key, label, value, color, formattedValue }" },
            { prop: "centerLabel", type: "ReactNode", description: "Rendered in the donut's empty center — typically a total." },
            { prop: "emptyState", type: "ReactNode", description: 'Shown when every segment is 0. Default: "No data."' },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The legend carries the same information as the ring in text form, so color-blind and screen-reader users
          aren&apos;t relying on hue alone to read the breakdown.
        </DocLead>
      </DocSection>
    </div>
  );
}
