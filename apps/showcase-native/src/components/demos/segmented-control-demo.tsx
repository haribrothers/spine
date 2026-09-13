import { useState } from "react";
import { SegmentedControl } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const PERIOD_OPTIONS = ["This week", "This month", "This year"];

export function SegmentedControlDemo() {
  const [period, setPeriod] = useState(PERIOD_OPTIONS[1]!);

  return (
    <>
      <DemoLead>
        A real, genuinely native segmented control — a SwiftUI `Picker` in `.segmented` style on iOS, a real Jetpack
        Compose `SingleChoiceSegmentedButtonRow` on Android. See Home's period control for this in real use.
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <SegmentedControl values={PERIOD_OPTIONS} value={period} onValueChange={setPeriod} style={{ height: 36, width: "100%" }} />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <SegmentedControl values={PERIOD_OPTIONS} value={period} onValueChange={() => {}} disabled style={{ height: 36, width: "100%" }} />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
