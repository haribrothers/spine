import { Sparkline } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const cash = [9800, 10200, 9900, 11050, 11300, 10900, 11800, 12024];
const overdue = [6100, 5900, 6400, 5800, 5200, 5100, 4700, 4542];

export default function SparklinePage() {
  return (
    <div>
      <DocTitle>Sparkline</DocTitle>
      <DocLead>A small trend line beside a key figure — e.g. the last 8 weeks of cash on a dashboard card.</DocLead>

      <ComponentPreview>
        <div className="flex items-center gap-6">
          <Sparkline values={cash} tone="positive" />
          <Sparkline values={overdue} tone="positive" />
          <Sparkline values={[...cash].reverse()} tone="negative" />
          <Sparkline values={cash} />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Scales any series to its own height; one point draws a flat line.",
            "Tones: positive (good for the business), negative and neutral — from theme tokens, so it works in dark mode.",
            "Decorative: hidden from screen readers, because the figure and its change are written beside it.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Sparkline } from "@spine/ui";

<Sparkline values={[9800, 10200, 9900, 12024]} tone="positive" />`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "values", type: "number[]", description: "Oldest first." },
            { prop: "tone", type: '"positive" | "negative" | "neutral"', defaultValue: '"neutral"' },
            { prop: "className", type: "string", description: "Size it, e.g. h-8 w-24 (the default)." },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Hidden from assistive technology; always pair it with the figure and its change in text (an arrow and a sign, not colour alone).</DocLead>
      </DocSection>
    </div>
  );
}
