import { useState } from "react";
import { View } from "react-native";
import { NativeTextField } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

function DefaultDemo() {
  const [value, setValue] = useState("Acme Contracting Ltd.");
  return <NativeTextField value={value} onChangeText={setValue} placeholder="Client name" />;
}

function ErrorDemo() {
  const [value, setValue] = useState("not-an-email");
  return <NativeTextField value={value} onChangeText={setValue} error />;
}

function DisabledDemo() {
  return <NativeTextField value="Read only" onChangeText={() => {}} disabled />;
}

export function NativeTextFieldScreen() {
  return (
    <DocScreen>
      <DocTitle>Native Text Field</DocTitle>
      <DocLead>
        A genuinely native text field — SwiftUI&apos;s `TextField` on iOS, Material3&apos;s `OutlinedTextField` on
        Android — colored with this design system&apos;s own tokens, not each platform&apos;s default theme. Additive
        alongside the existing `TextField`, not a replacement — see the component&apos;s own doc comment for when to
        reach for each.
      </DocLead>

      <ComponentPreview>
        <View className="w-64">
          <DefaultDemo />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Real native field chrome per platform — an SF-styled underline-free bordered field on iOS, a Material outlined field on Android — not a NativeWind-styled approximation of either.",
            "Every color (background, border, text, placeholder, cursor, error, disabled) is resolved from this package's own design tokens, on both platforms.",
            "A controlled component (value/onChangeText), like TextField — internally bridges to @expo/ui's observable-state API so the two share the same call-site shape.",
          ]}
        />
      </DocSection>

      <DocSection title="When to use vs. TextField">
        <DocLead>
          TextField (the existing component) renders RN&apos;s own TextInput with a NativeWind-drawn border — the
          right default for most forms today. Reach for NativeTextField specifically when a screen is adopting real
          native field/list chrome end to end (see the Edit Job template) — mixing the two on the same screen will
          look inconsistent, since their visual language genuinely differs by design.
        </DocLead>
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { NativeTextField } from "@spine/ui-native";

const [value, setValue] = useState("");

<NativeTextField value={value} onChangeText={setValue} placeholder="Client name" />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "string" },
            { prop: "onChangeText", type: "(text: string) => void" },
            { prop: "placeholder", type: "string" },
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
            { prop: "multiline", type: "boolean", defaultValue: "false" },
            { prop: "keyboardType", type: '"default" | "decimal" | "email" | "numeric" | "phone"', defaultValue: '"default"' },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<NativeTextField value={value} onChangeText={setValue} placeholder="Client name" />`}>
          <View className="w-64">
            <DefaultDemo />
          </View>
        </ComponentPreview>

        <DocLead>Error</DocLead>
        <ComponentPreview code={`<NativeTextField value={value} onChangeText={setValue} error />`}>
          <View className="w-64">
            <ErrorDemo />
          </View>
        </ComponentPreview>

        <DocLead>Disabled</DocLead>
        <ComponentPreview code={`<NativeTextField value="Read only" onChangeText={() => {}} disabled />`}>
          <View className="w-64">
            <DisabledDemo />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Renders a real native SwiftUI/Jetpack Compose text field, so VoiceOver/TalkBack announce it the same way
          they do for any native field — verified on-device, not via an automated test (the native bridge view
          carries no RNTL-queryable accessibility tree under jest-expo). `testID` reaches the native view on iOS only
          — `@expo/ui`&apos;s Compose `OutlinedTextField` exposes no `testID` prop at all.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
