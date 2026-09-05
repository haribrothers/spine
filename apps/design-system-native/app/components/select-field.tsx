import { useState } from "react";
import { SelectField } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

const STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

function SelectFieldDemo() {
  const [value, setValue] = useState("in_progress");
  return <SelectField options={STATUS_OPTIONS} value={value} onValueChange={setValue} />;
}

export function SelectFieldScreen() {
  return (
    <DocScreen>
      <DocTitle>Select Field</DocTitle>
      <DocLead>
        A `TextField`-styled select — same border, height, radius, and colors as TextField — for forms where a select
        needs to visually match surrounding text fields. Opens a real native menu (SwiftUI Menu on iOS, Jetpack
        Compose DropdownMenu on Android) on tap.
      </DocLead>

      <ComponentPreview>
        <SelectFieldDemo />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Matches TextField's exact border/height/radius/colors — for forms mixing selects and text fields, unlike Select's own native picker-button chrome.",
            "Opens @expo/ui's community MenuView on tap — the same native-menu primitive ContextMenu wraps.",
            "Shows a checkmark next to the currently-selected option in the menu.",
            "A chevron-down icon on the right signals it's a select, not a plain text field.",
          ]}
        />
      </DocSection>

      <DocSection title="When to use vs. Select">
        <DocLead>
          Select (the existing component) has no border/background style props at all — it renders whatever bare
          button chrome each platform&apos;s native Picker uses by default. That&apos;s the right, lightest-weight choice for a
          standalone control (e.g. a plain settings row). Reach for SelectField specifically when a select sits
          alongside TextFields in a form and needs to look like part of the same field group.
        </DocLead>
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { SelectField } from "@spine/ui-native";

const [status, setStatus] = useState("in_progress");

<SelectField
  options={[
    { label: "Not started", value: "not_started" },
    { label: "In progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
  ]}
  value={status}
  onValueChange={setStatus}
/>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "options", type: "{ label: string; value: T }[]" },
            { prop: "value", type: "T" },
            { prop: "onValueChange", type: "(value: T) => void" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
            { prop: "placeholder", type: "string", defaultValue: '"Select…"' },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<SelectField
  options={[
    { label: "Not started", value: "not_started" },
    { label: "In progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
  ]}
  value={status}
  onValueChange={setStatus}
/>`}
        >
          <SelectFieldDemo />
        </ComponentPreview>

        <DocLead>Disabled</DocLead>
        <ComponentPreview code={`<SelectField options={STATUS_OPTIONS} value="not_started" onValueChange={() => {}} disabled />`}>
          <SelectField options={STATUS_OPTIONS} value="not_started" onValueChange={() => {}} disabled />
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Opens a real native SwiftUI/Jetpack Compose menu, so VoiceOver/TalkBack announce each option and the current
          selection the same way they do for any native menu — verified on-device. When `disabled` is true, no
          MenuView is rendered at all (a static, non-interactive trigger), rather than a menu that looks disabled but
          still opens on tap — there is no whole-menu disabled prop on `@expo/ui`&apos;s MenuView to rely on instead.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
