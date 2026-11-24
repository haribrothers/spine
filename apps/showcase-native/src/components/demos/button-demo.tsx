import { View } from "react-native";
import { Button } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function ButtonDemo() {
  return (
    <>
      <DemoLead>
        `@expo/ui`’s universal Button — real SwiftUI `Button` on iOS, Jetpack Compose `Button` on Android. One
        primary (filled) action per screen; everything else is secondary (outlined) or ghost (text).
      </DemoLead>
      <DemoSection title="Variants">
        <DemoPreview>
          <View className="flex-row flex-wrap items-center gap-3">
            <Button variant="primary" onPress={() => {}}>
              Save
            </Button>
            <Button variant="secondary" onPress={() => {}}>
              Cancel
            </Button>
            <Button variant="danger" onPress={() => {}}>
              Delete
            </Button>
            <Button variant="ghost" onPress={() => {}}>
              Dismiss
            </Button>
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <Button variant="primary" disabled onPress={() => {}}>
            Save
          </Button>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
