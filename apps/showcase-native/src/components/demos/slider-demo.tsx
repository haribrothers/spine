import { useState } from "react";
import { Text, View } from "react-native";
import { Slider } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function SliderDemo() {
  const [value, setValue] = useState(0.5);

  return (
    <>
      <DemoLead>
        `@expo/ui`'s universal Slider — a real native slider. Single-thumb only, a deliberate narrowing from web's
        multi-thumb Slider (neither SwiftUI's nor Jetpack Compose's native Slider supports multiple thumbs).
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="w-full gap-2">
            <Slider value={value} onValueChange={setValue} />
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{value.toFixed(2)}</Text>
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
