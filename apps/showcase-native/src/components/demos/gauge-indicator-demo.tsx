import { GaugeIndicator } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function GaugeIndicatorDemo() {
  return (
    <>
      <DemoLead>
        A semi-circular animated progress gauge — see Home’s revenue-goal card for this in real use. Animates a
        genuine sweep-in from 0% on mount, not an instant jump to the final value.
      </DemoLead>
      <DemoSection title="Values">
        <DemoPreview>
          <GaugeIndicator
            progress={0.76}
            trackColor="rgba(33,31,26,0.12)"
            fillGradient={{ from: "#2954E5", to: "#2144BB" }}
            textColorClass="text-on-surface dark:text-on-surface-dark"
          />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Low / high">
        <DemoPreview>
          <GaugeIndicator
            progress={0.1}
            trackColor="rgba(33,31,26,0.12)"
            fillGradient={{ from: "#B3261E", to: "#921F18" }}
            textColorClass="text-on-surface dark:text-on-surface-dark"
          />
          <GaugeIndicator
            progress={1}
            trackColor="rgba(33,31,26,0.12)"
            fillGradient={{ from: "#177044", to: "#125B37" }}
            textColorClass="text-on-surface dark:text-on-surface-dark"
          />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
