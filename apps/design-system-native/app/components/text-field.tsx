import { View } from "react-native";
import { TextField } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function TextFieldScreen() {
  return (
    <DocScreen>
      <DocTitle>Text Field</DocTitle>
      <DocLead>
        A single-line text input, 44px height — mirrors {"packages/ui"}&apos;s Input, but on RN&apos;s TextInput.
        Always pair with a visible label above it, never placeholder-only.
      </DocLead>

      <ComponentPreview>
        <View className="w-64">
          <TextField placeholder="Acme Contracting Ltd." />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Renders RN's TextInput, so all native TextInputProps (keyboardType, autoComplete, secureTextEntry, …) pass through.",
            "An error prop switches the border to the overdue color, paired with a screen's own inline error text.",
            "44px height, matching the touch-size Button — consistent minimum touch target across the library.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { TextField } from "@spine/ui-native";

<TextField placeholder="Acme Contracting Ltd." />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "…", type: "standard TextInputProps" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<TextField placeholder="Acme Contracting Ltd." />`}>
          <View className="w-64">
            <TextField placeholder="Acme Contracting Ltd." />
          </View>
        </ComponentPreview>

        <DocLead>Error</DocLead>
        <ComponentPreview code={`<TextField error defaultValue="not-an-email" />`}>
          <View className="w-64">
            <TextField error defaultValue="not-an-email" />
          </View>
        </ComponentPreview>

        <DocLead>Disabled</DocLead>
        <ComponentPreview code={`<TextField editable={false} placeholder="Read only" />`}>
          <View className="w-64">
            <TextField editable={false} placeholder="Read only" />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Pair with a visible label rather than relying on placeholder alone — placeholder text disappears once a
          value is entered and isn&apos;t a reliable substitute for a label with assistive technology.
          accessibilityState reflects the editable prop automatically.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
