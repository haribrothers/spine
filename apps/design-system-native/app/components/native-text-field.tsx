import { useState } from "react";
import { Platform, Text, View } from "react-native";
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
        A genuinely native iOS text field, built directly from Apple&apos;s own SwiftUI `TextField` API — colored
        with this design system&apos;s own tokens, not the system default. iOS only; there is no Android equivalent
        of this component.
      </DocLead>

      {Platform.OS !== "ios" ? (
        <View className="rounded-lg border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
            NativeTextField is iOS-only — this preview has no content on the current platform.
          </Text>
        </View>
      ) : (
        <ComponentPreview>
          <View className="w-64">
            <DefaultDemo />
          </View>
        </ComponentPreview>
      )}

      <DocSection title="Features">
        <FeatureList
          items={[
            "A real SwiftUI TextField (via @expo/ui's swift-ui bridge) — real system text editing: native selection handles, cut/copy/paste/lookup menu, autofill, Live Text/QuickType.",
            "Every color (background, border, error state, disabled) is resolved from this package's own design tokens, never the system default.",
            "A controlled component (value/onChangeText), like TextField — internally bridges to @expo/ui's observable-state API so the two share the same call-site shape.",
          ]}
        />
      </DocSection>

      <DocSection title="Why .plain + a hand-drawn border, not .textFieldStyle(.roundedBorder)">
        <DocLead>
          SwiftUI&apos;s built-in `.roundedBorder` style has no modifier for customizing its border color — Apple
          provides none. Since this design system&apos;s own colors are a hard requirement, this component uses
          `.textFieldStyle(.plain)` (no built-in chrome at all) plus its own `background`/`strokeBorder` modifiers,
          the standard SwiftUI approach for a custom-colored bordered field.
        </DocLead>
      </DocSection>

      <DocSection title="When to use vs. TextField">
        <DocLead>
          TextField (the existing component) renders RN&apos;s own TextInput with a NativeWind-drawn border, and
          works identically on both platforms — the right default for most forms. Reach for NativeTextField
          specifically when an iOS screen wants real native field behavior end to end; it has no Android
          counterpart, so a cross-platform form mixing the two needs its own per-platform branch.
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

      {Platform.OS === "ios" ? (
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
      ) : null}

      <DocSection title="Accessibility">
        <DocLead>
          Renders a real native SwiftUI text field, so VoiceOver announces it the same way it does for any native
          field — verified on-device, not via an automated test (the native bridge view carries no RNTL-queryable
          accessibility tree under jest-expo).
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
