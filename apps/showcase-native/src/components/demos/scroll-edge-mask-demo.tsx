import { ScrollView, Text, View } from "react-native";
import { ScrollEdgeMask } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const ROWS = ["Marina office fit-out", "Phase 2 townhomes — foundations", "Hotel lobby renovation", "Kitchen extension", "Roof repair", "Bathroom remodel", "Deck installation", "Fence replacement"];

/**
 * US-MOB-21 — ScrollEdgeMask is the Android stand-in for iOS 26's scroll
 * edge effect (docs/design/native-notes.md): a gradient from the page
 * background to transparent, laid over the top or bottom of a scroll view so
 * content fades out under the header or tab bar instead of being cut off.
 */
export function ScrollEdgeMaskDemo() {
  return (
    <>
      <DemoLead>
        A fade from the page background to transparent, laid over the top or bottom edge of a scroll view so content
        fades under a header or tab bar. Use it on Android; iOS draws its own scroll edge effect.
      </DemoLead>
      <DemoSection title="Bottom edge over a list">
        <DemoPreview>
          <View className="h-56 w-full overflow-hidden rounded-lg">
            <ScrollView contentContainerClassName="gap-2 p-3">
              {ROWS.map((row) => (
                <View key={row} className="rounded-lg bg-surface p-3 dark:bg-surface-dark">
                  <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">{row}</Text>
                </View>
              ))}
            </ScrollView>
            <ScrollEdgeMask edge="bottom" height={48} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Top edge under a header">
        <DemoPreview>
          <View className="h-40 w-full overflow-hidden rounded-lg">
            <ScrollView contentContainerClassName="gap-2 p-3" contentOffset={{ x: 0, y: 40 }}>
              {ROWS.map((row) => (
                <View key={row} className="rounded-lg bg-surface p-3 dark:bg-surface-dark">
                  <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">{row}</Text>
                </View>
              ))}
            </ScrollView>
            <ScrollEdgeMask edge="top" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
