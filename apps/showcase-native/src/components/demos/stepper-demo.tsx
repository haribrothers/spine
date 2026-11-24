import { useState } from "react";
import { Stepper } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function StepperDemo() {
  const [crewSize, setCrewSize] = useState(4);

  return (
    <>
      <DemoLead>
        A numeric +/- stepper — the SAME custom `-`/value/`+` row on both platforms (Jetpack Compose has no native
        stepper control, so a real native SwiftUI Stepper on iOS was tried and reverted to keep both platforms
        matching visually — see this component’s own doc comment).
      </DemoLead>
      <DemoSection title="Default (1–20)">
        <DemoPreview>
          <Stepper value={crewSize} onValueChange={setCrewSize} min={1} max={20} />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="At the min/max boundary">
        <DemoPreview>
          <Stepper value={1} onValueChange={() => {}} min={1} max={20} />
          <Stepper value={20} onValueChange={() => {}} min={1} max={20} />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <Stepper value={4} onValueChange={() => {}} min={1} max={20} disabled />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
