import { useState } from "react";
import { Switch } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function SwitchDemo() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);

  return (
    <>
      <DemoLead>`@expo/ui`’s universal Switch — a real native on/off toggle.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <Switch value={on} onValueChange={setOn} label="Enable notifications" />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="States">
        <DemoPreview>
          <Switch value={off} onValueChange={setOff} label="Off" />
          <Switch value={true} onValueChange={() => {}} label="Disabled, on" disabled />
          <Switch value={false} onValueChange={() => {}} label="Disabled, off" disabled />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
