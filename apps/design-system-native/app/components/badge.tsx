import { View } from "react-native";
import { Badge } from "@spine/ui-native";
import { DocScreen, DocSection } from "../../src/components/doc-section";

export function BadgeScreen() {
  return (
    <DocScreen>
      <DocSection title="Default">
        <View className="flex-row gap-2">
          <Badge>Draft</Badge>
          <Badge>New</Badge>
          <Badge>Archived</Badge>
        </View>
      </DocSection>
    </DocScreen>
  );
}
