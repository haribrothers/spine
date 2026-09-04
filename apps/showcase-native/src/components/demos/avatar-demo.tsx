import { View } from "react-native";
import { Avatar } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function AvatarDemo() {
  return (
    <>
      <DemoLead>A circular image or initials placeholder, falling back automatically on a load error.</DemoLead>
      <DemoSection title="Sizes">
        <DemoPreview>
          <View className="flex-row items-center gap-3">
            <Avatar size="sm" fallback="AC" />
            <Avatar size="md" fallback="AC" />
            <Avatar size="lg" fallback="AC" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
