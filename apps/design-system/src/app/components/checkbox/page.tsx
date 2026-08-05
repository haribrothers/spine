import { Checkbox } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function CheckboxPage() {
  return (
    <div>
      <DocTitle>Checkbox</DocTitle>
      <DocLead>
        18px control with a 44px tap target via padding on touch surfaces, primary-blue fill
        when checked.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<label className="flex items-center gap-2">
  <Checkbox defaultChecked />
  <span className="text-[14px]">Mark as billable to customer</span>
</label>`}
        >
          <label className="flex items-center gap-2">
            <Checkbox defaultChecked />
            <span className="text-[14px] text-on-surface">Mark as billable to customer</span>
          </label>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
