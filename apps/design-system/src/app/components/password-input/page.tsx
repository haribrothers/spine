import { FormField, PasswordInput } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function PasswordInputPage() {
  return (
    <div>
      <DocTitle>PasswordInput</DocTitle>
      <DocLead>
        A password field with a show/hide eye and a Caps Lock warning — used on login, sign-up, reset password and
        Profile › Password (US-AUTH-14, US-AUTH-15).
      </DocLead>

      <ComponentPreview>
        <div className="w-80">
          <FormField label="Password" required>
            {(field) => <PasswordInput {...field} autoComplete="current-password" />}
          </FormField>
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Built on PasswordToggleField (Radix): the eye is a button named “Show password” or “Hide password”.",
            "While someone types with Caps Lock on, “Caps Lock is on.” shows under the field and the field points to it (aria-describedby).",
            "Spreads FormField's render props like any input, so the label, required marker and errors work as everywhere else.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { FormField, PasswordInput } from "@spine/ui";

<FormField label="Password" required>
  {(field) => <PasswordInput {...field} autoComplete="current-password" />}
</FormField>;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "capsLockHint", type: "boolean", defaultValue: "true" },
            { prop: "autoComplete", type: '"current-password" | "new-password"' },
            { prop: "…", type: "standard <input> attributes" },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The eye button is reachable by keyboard and named for what it does. The Caps Lock line is plain text the
          field refers to, so a screen reader reads it with the field rather than interrupting.
        </DocLead>
      </DocSection>
    </div>
  );
}
