import { View } from "react-native";
import { FullWidthButton } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function FullWidthButtonDemo() {
  return (
    <>
      <DemoLead>
        A genuinely full-width native button — see this component’s own doc comment for why `Button`’s own `fullWidth`
        prop doesn’t work and this exists instead.
      </DemoLead>
      <DemoSection title="Variants">
        <DemoPreview>
          <View className="w-full gap-3">
            <FullWidthButton label="Save" onPress={() => {}} />
            <FullWidthButton label="Cancel" variant="secondary" onPress={() => {}} />
            <FullWidthButton label="Delete job" variant="danger" onPress={() => {}} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Shape">
        <DemoPreview>
          <View className="w-full gap-3">
            <FullWidthButton label="Pill (default)" onPress={() => {}} shape="pill" />
            <FullWidthButton label="Rounded" onPress={() => {}} shape="rounded" />
            <FullWidthButton label="Sharp" onPress={() => {}} shape="sharp" />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="States">
        <DemoPreview>
          <View className="w-full gap-3">
            <FullWidthButton label="Disabled" onPress={() => {}} disabled />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
