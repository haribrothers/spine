import { useState } from "react";
import { View } from "react-native";
import { OutlinedTextField, SelectListField } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

const JOBS = [
  { label: "Kitchen remodel", value: "kitchen" },
  { label: "Warehouse extension", value: "warehouse" },
];

function OutlinedDemo() {
  const [caption, setCaption] = useState("");
  const [job, setJob] = useState("kitchen");
  const [amount, setAmount] = useState("");
  return (
    <View className="gap-4">
      <OutlinedTextField label="Caption" placeholder="What does this photo show?" value={caption} onChangeText={setCaption} />
      <SelectListField variant="outlined" floatingLabel="Job" sheetTitle="Job" options={JOBS} value={job} onValueChange={setJob} />
      <OutlinedTextField label="Amount (USD)" prefix="$" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} error={amount === "0"} helperText={amount === "0" ? "Enter an amount above zero." : undefined} />
    </View>
  );
}

export function OutlinedTextFieldScreen() {
  return (
    <DocScreen>
      <DocTitle>Outlined Text Field</DocTitle>
      <DocLead>
        Material 3&apos;s outlined field — the Android form look in the field app (photo review, new expense, Mark complete).
        The label sits in a notch on the outline. iOS forms keep FormSection and FormRow; screens choose per platform.
      </DocLead>

      <ComponentPreview>
        <OutlinedDemo />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "The label sits on the top edge; the outline turns primary and thicker while focused, and the overdue colour on error.",
            "Errors also show as text under the field and are read as the input's hint — never colour alone.",
            "Optional prefix (e.g. \"$\") and multiline for notes.",
            "secureTextEntry hides a password and adds Material's labelled show/hide eye; an error adds the trailing error icon.",
            "OutlinedFrame wraps any content in the same outline — SelectListField's variant=\"outlined\" uses it for Material's exposed dropdown (▾).",
            "The notch is the label's own background: pass labelBackgroundClassName when the field sits on a card rather than the page.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { OutlinedTextField, SelectListField } from "@spine/ui-native";

<OutlinedTextField
  label="Caption"
  placeholder="What does this photo show?"
  value={caption}
  onChangeText={setCaption}
/>

<SelectListField
  variant="outlined"
  floatingLabel="Job"
  sheetTitle="Job"
  options={jobs}
  value={jobId}
  onValueChange={setJobId}
/>`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "label", type: "string" },
            { prop: "value", type: "string" },
            { prop: "onChangeText", type: "(text: string) => void" },
            { prop: "placeholder", type: "string" },
            { prop: "prefix", type: "string" },
            { prop: "multiline", type: "boolean", defaultValue: "false" },
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "helperText", type: "string" },
            { prop: "secureTextEntry", type: "boolean", defaultValue: "false" },
            { prop: "inputRef", type: "Ref<TextInput>" },
            { prop: "labelBackgroundClassName", type: "string", defaultValue: '"bg-background dark:bg-background-dark"' },
          ]}
        />
      </DocSection>
    </DocScreen>
  );
}
