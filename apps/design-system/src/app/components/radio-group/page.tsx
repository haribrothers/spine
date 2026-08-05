import { RadioGroup, RadioGroupItem } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function RadioGroupPage() {
  return (
    <div>
      <DocTitle>RadioGroup</DocTitle>
      <DocLead>
        A set of checkable buttons — known as radio buttons — where no more than one can be
        checked at a time. E.g. tax-inclusive vs. tax-exclusive pricing.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Full keyboard navigation.", "Can be controlled or uncontrolled."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { RadioGroup, RadioGroupItem } from "@spine/ui";

export default () => (
  <RadioGroup>
    <RadioGroupItem value="1" />
  </RadioGroup>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "string" },
            { prop: "defaultValue", type: "string" },
            { prop: "onValueChange", type: "(value: string) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<RadioGroup defaultValue="exclusive">
  <label className="flex items-center gap-2">
    <RadioGroupItem value="exclusive" />
    <span>Tax-exclusive</span>
  </label>
  <label className="flex items-center gap-2">
    <RadioGroupItem value="inclusive" />
    <span>Tax-inclusive</span>
  </label>
</RadioGroup>`}
        >
          <RadioGroup defaultValue="exclusive">
            <label className="flex items-center gap-2">
              <RadioGroupItem value="exclusive" />
              <span className="text-[14px] text-on-surface">Tax-exclusive</span>
            </label>
            <label className="flex items-center gap-2">
              <RadioGroupItem value="inclusive" />
              <span className="text-[14px] text-on-surface">Tax-inclusive</span>
            </label>
          </RadioGroup>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the checked item, or the first item if none is checked." },
            { keys: "ArrowDown", description: "Moves focus and checks the next item." },
            { keys: "ArrowUp", description: "Moves focus and checks the previous item." },
          ]}
        />
      </DocSection>
    </div>
  );
}
