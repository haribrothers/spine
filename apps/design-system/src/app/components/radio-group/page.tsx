import { RadioGroup, RadioGroupItem } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function RadioGroupPage() {
  return (
    <div>
      <DocTitle>RadioGroup</DocTitle>
      <DocLead>A mutually-exclusive set of options — e.g. tax-inclusive vs. tax-exclusive pricing.</DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
