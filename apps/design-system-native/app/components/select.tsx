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
            "Uses @expo/ui's universal Picker — a real native SwiftUI/Jetpack Compose dropdown via a Host bridge, not a NativeWind-styled RN primitive.",
            "Themed via Host's seedColor/colorScheme, matching every other @expo/ui-backed component in this package — not a per-component color prop.",
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
            { prop: "onValueChange", type: "(value: T) => void" },
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
          Renders a real native SwiftUI/Jetpack Compose picker, so VoiceOver/TalkBack announce the current selection
          and available options the same way they do for any native picker control — verified on-device, not via an
          automated test (the native bridge view carries no RNTL-queryable accessibility tree under jest-expo).
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
