import { PasswordToggleField, PasswordToggleFieldInput, PasswordToggleFieldToggle } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function PasswordToggleFieldPage() {
  return (
    <div>
      <DocTitle>PasswordToggleField</DocTitle>
      <DocLead>
        A password field with a control for toggling its visibility — genuinely useful for
        Spine's own sign-up/login screens (§5's email+password auth).
      </DocLead>

      <ComponentPreview>
        <PasswordToggleField>
          <div className="relative w-64">
            <PasswordToggleFieldInput placeholder="Password" />
            <PasswordToggleFieldToggle />
          </div>
        </PasswordToggleField>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Toggling visibility does not clear the field or move the caret unexpectedly.",
            "The eye/eye-off icon swaps automatically via PasswordToggleFieldIcon.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { PasswordToggleField, PasswordToggleFieldInput, PasswordToggleFieldToggle } from "@spine/ui";

export default () => (
  <PasswordToggleField>
    <PasswordToggleFieldInput />
    <PasswordToggleFieldToggle />
  </PasswordToggleField>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "defaultVisible", type: "boolean", defaultValue: "false" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<PasswordToggleField>
  <div className="relative">
    <PasswordToggleFieldInput placeholder="Password" />
    <PasswordToggleFieldToggle />
  </div>
</PasswordToggleField>`}
        >
          <PasswordToggleField>
            <div className="relative w-64">
              <PasswordToggleFieldInput placeholder="Password" />
              <PasswordToggleFieldToggle />
            </div>
          </PasswordToggleField>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>The toggle button announces its current action ("Show password" / "Hide password") to screen readers.</DocLead>
        <KeyboardTable rows={[{ keys: "Space", description: "Toggles password visibility when the toggle button is focused." }]} />
      </DocSection>
    </div>
  );
}
