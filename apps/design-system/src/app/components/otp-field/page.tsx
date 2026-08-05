import { OTPField, OTPFieldHiddenInput, OTPFieldInput } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function OTPFieldPage() {
  return (
    <div>
      <DocTitle>OTPField</DocTitle>
      <DocLead>
        A one-time password/passcode field with individually boxed digit inputs. Not currently
        used anywhere in Spine's auth flow — email+password plus an org invite per §5/§10.3,
        with no OTP step — included in the catalogue for completeness.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Handles paste — pasting a full code fills every box at once.",
            "Auto-advances focus to the next box as digits are typed.",
            "Backed by a single hidden <input> so the field still submits as one value inside a native <form>.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { OTPField, OTPFieldInput, OTPFieldHiddenInput } from "@spine/ui";

export default () => (
  <OTPField>
    <OTPFieldInput />
    <OTPFieldInput />
    <OTPFieldInput />
    <OTPFieldInput />
    <OTPFieldHiddenInput name="otp" />
  </OTPField>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "OTPField.value", type: "string" },
            { prop: "OTPField.onValueChange", type: "(value: string) => void" },
            { prop: "OTPFieldInput", type: "one per digit position, order-dependent" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<OTPField>
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldHiddenInput name="otp" />
</OTPField>`}
        >
          <OTPField className="flex gap-2">
            <OTPFieldInput />
            <OTPFieldInput />
            <OTPFieldInput />
            <OTPFieldInput />
            <OTPFieldHiddenInput name="otp" />
          </OTPField>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "ArrowRight", description: "Moves focus to the next box." },
            { keys: "ArrowLeft", description: "Moves focus to the previous box." },
            { keys: "Backspace", description: "Clears the current box and moves focus back." },
          ]}
        />
      </DocSection>
    </div>
  );
}
