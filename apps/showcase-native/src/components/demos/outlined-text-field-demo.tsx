import { useState } from "react";
import { View } from "react-native";
import { OutlinedTextField, SelectListField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const JOBS = [
  { label: "Kitchen remodel", value: "kitchen" },
  { label: "Warehouse extension", value: "warehouse" },
];

/** Material 3's outlined field — the Android form look in the field app; iOS forms keep FormSection and FormRow. */
export function OutlinedTextFieldDemo() {
  const [caption, setCaption] = useState("");
  const [job, setJob] = useState("kitchen");
  const [amount, setAmount] = useState("0");
  const [password, setPassword] = useState("");
  return (
    <>
      <DemoLead>
        Material 3&apos;s outlined field — the Android form look in the field app (photo review, new expense, Mark complete). The label sits in a notch on the outline; it turns primary while focused and the overdue colour on error, with the error also written under the field.
      </DemoLead>
      <DemoSection title="Fields">
        <DemoPreview>
          <View className="w-full gap-4">
            <OutlinedTextField label="Caption" placeholder="What does this photo show?" value={caption} onChangeText={setCaption} labelBackgroundClassName="bg-surface dark:bg-surface-dark" />
            <SelectListField variant="outlined" floatingLabel="Job" sheetTitle="Job" options={JOBS} value={job} onValueChange={setJob} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Prefix and error">
        <DemoPreview>
          <View className="w-full">
            <OutlinedTextField
              label="Amount (USD)"
              prefix="$"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              error={amount === "0"}
              helperText={amount === "0" ? "Enter an amount above zero." : undefined}
              labelBackgroundClassName="bg-surface dark:bg-surface-dark"
            />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Password">
        <DemoPreview>
          <View className="w-full">
            <OutlinedTextField label="Password" secureTextEntry value={password} onChangeText={setPassword} labelBackgroundClassName="bg-surface dark:bg-surface-dark" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
