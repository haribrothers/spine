import { Toggle } from "@spine/ui";
import { Bold } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function TogglePage() {
  return (
    <div>
      <DocTitle>Toggle</DocTitle>
      <DocLead>
        A two-state button that can be either on or off — e.g. a rich-text formatting control.
        Visually similar to Button but tracks on/off state rather than firing an action.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Can be controlled or uncontrolled.", "Supports disabled state."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Toggle } from "@spine/ui";

export default () => <Toggle>B</Toggle>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "pressed", type: "boolean" },
            { prop: "defaultPressed", type: "boolean" },
            { prop: "onPressedChange", type: "(pressed: boolean) => void" },
            { prop: "size", type: "default | sm", defaultValue: "default" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Toggle aria-label="Bold"><Bold size={16} /></Toggle>`}>
          <Toggle aria-label="Bold">
            <Bold size={16} />
          </Toggle>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Provide an aria-label when the toggle is icon-only, so its purpose is announced.</DocLead>
        <KeyboardTable rows={[{ keys: "Space", description: "Toggles pressed state." }, { keys: "Enter", description: "Toggles pressed state." }]} />
      </DocSection>
    </div>
  );
}
