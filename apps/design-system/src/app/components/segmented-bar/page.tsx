"use client";

import { SegmentedBar } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const segments = [
  { key: "current", label: "Current", value: 30623, formattedValue: "$30,623.00", color: "var(--color-paid)" },
  { key: "0-30", label: "1–30 days", value: 4542.5, formattedValue: "$4,542.50", color: "var(--color-due-soon)" },
  { key: "31-60", label: "31–60 days", value: 1200, formattedValue: "$1,200.00", color: "var(--color-overdue)" },
  { key: "61-90", label: "61–90 days", value: 0, formattedValue: "$0.00", color: "var(--color-overdue)" },
  { key: "90+", label: "90+ days", value: 850, formattedValue: "$850.00", color: "var(--color-overdue)" },
];

export default function SegmentedBarPage() {
  return (
    <div>
      <DocTitle>SegmentedBar</DocTitle>
      <DocLead>
        One bar split into parts — what&apos;s owed by age on Receivables and Payables — with a text legend giving every part&apos;s amount and share, so colour is
        never the only signal.
      </DocLead>

      <ComponentPreview>
        <SegmentedBar segments={segments} aria-label="Outstanding by age" className="w-full" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Each part's width is its share of the total; parts worth zero are left out of the bar but stay in the legend.",
            "The legend names every part with its formatted amount and percentage.",
            "Colours are theme tokens — the reserved financial-status colours for ages.",
            "An empty state when everything is zero.",
            "Optionally pressable: each part filters a list (Receivables, US-PAY-29) — the legend entries become buttons marked pressed, and the other parts fade on the bar.",
          ]}
        />
      </DocSection>

      <DocSection id="empty" title="Empty">
        <ComponentPreview>
          <SegmentedBar segments={segments.map((s) => ({ ...s, value: 0 }))} aria-label="Outstanding by age" emptyState="Nothing outstanding." className="w-full" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="pressable" title="Pressable parts">
        <ComponentPreview
          code={`<SegmentedBar
  aria-label="Outstanding by age"
  segments={segments}
  selectedKeys={age ? [age] : []}
  onSegmentClick={(key) => setAge(age === key ? null : key)}
/>`}
        >
          <PressableExample />
        </ComponentPreview>
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { SegmentedBar } from "@spine/ui";

<SegmentedBar
  aria-label="Outstanding by age"
  segments={[{ key: "current", label: "Current", value: 30623, formattedValue: "$30,623.00", color: "var(--color-paid)" }, …]}
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "segments", type: "SegmentedBarSegment[]", description: "{ key, label, value, formattedValue, color }" },
            { prop: "aria-label", type: "string", description: "Names the bar; every part's label and amount are added to it." },
            { prop: "emptyState", type: "ReactNode", defaultValue: '"Nothing to show."' },
            { prop: "onSegmentClick", type: "(key: string) => void", description: "Makes each part pressable: a legend button, and the bar by pointer (US-PAY-29)." },
            { prop: "selectedKeys", type: "readonly string[]", description: "The parts shown as pressed (aria-pressed); the others fade on the bar." },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>The bar is a labelled image whose name lists every part and amount; the legend repeats them in text. When pressable, each legend entry is a button with aria-pressed, reachable with Tab — the bar itself is only a pointer shortcut.</DocLead>
      </DocSection>
    </div>
  );
}

function PressableExample() {
  const [age, setAge] = useState<string | null>("0-30");
  return <SegmentedBar segments={segments} aria-label="Outstanding by age" className="w-full" selectedKeys={age ? [age] : []} onSegmentClick={(key) => setAge(age === key ? null : key)} />;
}
