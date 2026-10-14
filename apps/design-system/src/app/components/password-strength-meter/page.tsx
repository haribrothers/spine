import { PasswordStrengthMeter } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function PasswordStrengthMeterPage() {
  return (
    <div>
      <DocTitle>PasswordStrengthMeter</DocTitle>
      <DocLead>
        How strong a new password is, as it&apos;s typed: a four-part meter, its level and a checklist (US-AUTH-15).
        The rules are <code>passwordStrength</code> in <code>@spine/shared</code>, the same ones the server uses.
      </DocLead>

      <ComponentPreview>
        <div className="flex w-96 flex-col gap-6">
          <PasswordStrengthMeter password="riverstone8" />
          <PasswordStrengthMeter password="Deck&Pergola-2026" />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Levels: Too short · Weak · Fair · Good · Strong, filling one to four parts in the overdue, due-soon, primary and paid colours.",
            "The checklist: at least 8 characters (required), 12 or more, letters numbers and symbols, not a common password, no repeats or sequences.",
            "Under 8 characters or a common password is refused by the form and the server; anything weaker is a warning.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { PasswordStrengthMeter } from "@spine/ui";

<PasswordStrengthMeter password={password} />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "password", type: "string" },
            { prop: "checklist", type: "boolean", defaultValue: "true" },
            { prop: "id", type: "string (point the field's aria-describedby at it)" },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The level is a polite live region (&ldquo;Password strength: Good&rdquo;), and each checklist item says
          whether it&apos;s done in words as well as with its icon, never by colour alone.
        </DocLead>
      </DocSection>
    </div>
  );
}
