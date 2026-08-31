import { useState } from "react";
import { Select } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

const CURRENCY_OPTIONS = [
  { label: "USD", value: "usd" },
  { label: "EUR", value: "eur" },
  { label: "JPY", value: "jpy" },
];

function SelectDemo() {
  const [value, setValue] = useState("usd");
  return <Select options={CURRENCY_OPTIONS} value={value} onValueChange={(v) => setValue(v)} />;
}

export function SelectScreen() {
  return (
    <DocScreen>
      <DocTitle>Select</DocTitle>
      <DocLead>
        A single-choice picker for simple flat option lists — the native counterpart to web&apos;s NativeSelect. Uses
        the OS&apos;s own native picker chrome (a wheel/dialog on iOS/Android, a real &lt;select&gt; on web), the
        lightest-weight option when a custom-styled menu isn&apos;t needed.
      </DocLead>

      <ComponentPreview>
        <SelectDemo />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Uses @react-native-picker/picker, the standard Expo-supported native picker — a new dependency of this package, added specifically for this component.",
            "The wrapping container (border/background/error state) supports NativeWind className; Picker itself only accepts style, since it's a native host component rather than a plain RN core component NativeWind's babel plugin transforms.",
            "error renders an overdue-colored border, matching TextField's own error styling.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Select } from "@spine/ui-native";

const [value, setValue] = useState("usd");

<Select
  options={[{ label: "USD", value: "usd" }, { label: "EUR", value: "eur" }]}
  value={value}
  onValueChange={setValue}
/>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "options", type: "{ label: string; value: T }[]" },
            { prop: "value", type: "T" },
            { prop: "onValueChange", type: "(value: T, index: number) => void" },
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "enabled", type: "boolean", defaultValue: "true" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Select
  options={[{ label: "USD", value: "usd" }, { label: "EUR", value: "eur" }, { label: "JPY", value: "jpy" }]}
  value={value}
  onValueChange={setValue}
/>`}
        >
          <SelectDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Inherits the OS&apos;s own native picker accessibility support automatically — VoiceOver/TalkBack announce
          the current selection and available options the same way they do for any native picker control.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
