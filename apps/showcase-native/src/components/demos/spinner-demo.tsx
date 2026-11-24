import { View } from "react-native";
import { Spinner } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function SpinnerDemo() {
  return (
    <>
      <DemoLead>An indeterminate loading indicator for actions with no known duration.</DemoLead>
      <DemoSection title="Sizes">
        <DemoPreview>
          <View className="flex-row items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
