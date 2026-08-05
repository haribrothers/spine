import { Slider } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function SliderPage() {
  return (
    <div>
      <DocTitle>Slider</DocTitle>
      <DocLead>
        An input where the user selects a value from within a given range — e.g. a discount
        percentage or retention percentage. Primary-filled track.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Can be controlled or uncontrolled.", "Supports multiple thumbs for a range.", "Full keyboard navigation."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Slider } from "@spine/ui";

export default () => <Slider defaultValue={[10]} max={100} step={1} />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "number[]" },
            { prop: "defaultValue", type: "number[]" },
            { prop: "onValueChange", type: "(value: number[]) => void" },
            { prop: "min", type: "number", defaultValue: "0" },
            { prop: "max", type: "number", defaultValue: "100" },
            { prop: "step", type: "number", defaultValue: "1" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Slider defaultValue={[10]} max={100} step={1} className="w-64" />`}>
          <Slider defaultValue={[10]} max={100} step={1} className="w-64" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "ArrowRight", description: "Increases the value by step." },
            { keys: "ArrowLeft", description: "Decreases the value by step." },
            { keys: "Home", description: "Sets the value to min." },
            { keys: "End", description: "Sets the value to max." },
          ]}
        />
      </DocSection>
    </div>
  );
}
