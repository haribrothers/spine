import { Switch } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function SwitchPage() {
  return (
    <div>
      <DocTitle>Switch</DocTitle>
      <DocLead>A control that allows toggling between checked and not checked — e.g. "require owner approval" flags.</DocLead>

      <ComponentPreview>
        <label className="flex items-center gap-2">
          <Switch defaultChecked />
          <span className="text-[14px] text-on-surface">
            Require owner approval above discount threshold
          </span>
        </label>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Full keyboard navigation.", "Can be controlled or uncontrolled."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Switch } from "@spine/ui";

export default () => <Switch />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "checked", type: "boolean" },
            { prop: "defaultChecked", type: "boolean" },
            { prop: "onCheckedChange", type: "(checked: boolean) => void" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<label className="flex items-center gap-2">
  <Switch defaultChecked />
  <span>Require owner approval above discount threshold</span>
</label>`}
        >
          <label className="flex items-center gap-2">
            <Switch defaultChecked />
            <span className="text-[14px] text-on-surface">
              Require owner approval above discount threshold
            </span>
          </label>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable rows={[{ keys: "Space", description: "Toggles the switch." }]} />
      </DocSection>
    </div>
  );
}
