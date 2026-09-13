import { useState } from "react";
import { Platform, View } from "react-native";
import { NativeTextField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function NativeTextFieldDemo() {
  const [value, setValue] = useState("Kitchen extension");

  if (Platform.OS !== "ios") {
    return (
      <DemoLead>
        `NativeTextField` is `@expo/ui/swift-ui`'s real SwiftUI `TextField`, iOS-only by design (no Jetpack Compose
        equivalent is used here — `FloatingLabelField`/`TextField` cover Android). Run this demo on iOS to see it.
      </DemoLead>
    );
  }

  return (
    <>
      <DemoLead>
        `@expo/ui/swift-ui`'s real SwiftUI `TextField`, iOS-only — the iOS pilot `FloatingLabelField` wraps
        internally. Not used directly on Android (`TextField` covers that platform there).
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="w-full">
            <NativeTextField value={value} onChangeText={setValue} placeholder="Job title" variant="bordered" />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Error">
        <DemoPreview>
          <View className="w-full">
            <NativeTextField value="" onChangeText={() => {}} placeholder="Required field" error variant="bordered" />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <View className="w-full">
            <NativeTextField value="Read-only value" onChangeText={() => {}} disabled variant="bordered" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
