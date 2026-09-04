import { useState } from "react";
import { TextField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function TextFieldDemo() {
  const [value, setValue] = useState("");

  return (
    <>
      <DemoLead>A themed text input, styled via NativeWind — no native equivalent exists to bridge into.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <TextField value={value} onChangeText={setValue} placeholder="Client name" className="w-full" />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Error">
        <DemoPreview>
          <TextField value="" onChangeText={() => {}} placeholder="Required field" error className="w-full" />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <TextField value="Read-only value" onChangeText={() => {}} editable={false} className="w-full" />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
