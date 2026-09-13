import { useState } from "react";
import { Text } from "react-native";
import { FormRow, FormSection, Switch } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function FormRowDemo() {
  const [retentionHeld, setRetentionHeld] = useState(true);

  return (
    <>
      <DemoLead>
        The grouped-card form layout — `FormSection` renders an uppercase caption above one borderless card;
        `FormRow` is a fixed-height row inside it, with a full-bleed divider between rows. See Templates → Job Edit
        for this at full form scale.
      </DemoLead>
      <DemoSection title="Plain-label rows">
        <DemoPreview>
          <FormSection title="Billing">
            <FormRow label="Retention held" last>
              <Switch value={retentionHeld} onValueChange={setRetentionHeld} />
            </FormRow>
          </FormSection>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="With a validation error">
        <DemoPreview>
          <FormSection title="Details" description="An example section description.">
            <FormRow error="Title is required.">
              <Text className="text-on-surface-muted dark:text-on-surface-muted-dark">A field that failed validation</Text>
            </FormRow>
            <FormRow last>
              <Text className="text-on-surface-muted dark:text-on-surface-muted-dark">A field with no label (renders its own)</Text>
            </FormRow>
          </FormSection>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
