import { Text, View } from "react-native";
import { Divider } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function DividerDemo() {
  return (
    <>
      <DemoLead>
        A plain 1px row separator for INSIDE a form card/group between rows — full-bleed, no horizontal inset, so it
        reads as separating two rows rather than framing one field. Never a standalone section separator on its own.
      </DemoLead>
      <DemoSection title="Between rows in a card">
        <DemoPreview>
          <View className="w-full rounded-lg bg-surface dark:bg-surface-dark">
            <View className="p-4">
              <Text className="text-on-surface dark:text-on-surface-dark">Row one</Text>
            </View>
            <Divider />
            <View className="p-4">
              <Text className="text-on-surface dark:text-on-surface-dark">Row two</Text>
            </View>
            <Divider />
            <View className="p-4">
              <Text className="text-on-surface dark:text-on-surface-dark">Row three</Text>
            </View>
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
