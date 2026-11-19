import { Checkbox } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function CheckboxPage() {
  return (
    <div>
      <DocTitle>Checkbox</DocTitle>
      <DocLead>
        A control that allows the user to toggle between checked, unchecked, and indeterminate.
        18px control with a 44px tap target via padding on touch surfaces, primary-blue fill
        when checked.
      </DocLead>

      <ComponentPreview>
        <label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          <span className="text-[14px] text-on-surface">Mark as billable to customer</span>
        </label>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Can be controlled or uncontrolled.",
            "Supports indeterminate state.",
            "Full keyboard navigation.",
            "Under 768px it keeps its 18px size, with a 44px tap area drawn around it (US-OPS-61).",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Checkbox } from "@spine/ui";

export default () => <Checkbox />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "checked", type: "boolean | 'indeterminate'" },
            { prop: "defaultChecked", type: "boolean" },
            { prop: "onCheckedChange", type: "(checked: boolean | 'indeterminate') => void" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<label className="flex items-center gap-2">
  <Checkbox defaultChecked />
  <span>Mark as billable to customer</span>
</label>`}
        >
          <label className="flex items-center gap-2">
            <Checkbox defaultChecked />
            <span className="text-[14px] text-on-surface">Mark as billable to customer</span>
          </label>
        </ComponentPreview>
        <DocLead>Indeterminate</DocLead>
        <ComponentPreview
          code={`<Checkbox checked="indeterminate" aria-label="Select every row on this page" />`}
        >
          <label className="flex items-center gap-2">
            <Checkbox checked="indeterminate" />
            <span className="text-[14px] text-on-surface">Select every row on this page (some are)</span>
          </label>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[{ keys: "Space", description: "Toggles the checkbox." }]}
        />
      </DocSection>
    </div>
  );
}
