import { View } from "react-native";
import { Badge } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function BadgeDemo() {
  return (
    <>
      <DemoLead>A neutral pill label for tags and metadata — never used for financial status, that’s StatusChip’s job.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="flex-row flex-wrap gap-2">
            <Badge>Recurring</Badge>
            <Badge>New client</Badge>
            <Badge>Fixed price</Badge>
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
