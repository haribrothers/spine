import { View } from "react-native";
import { Skeleton } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function SkeletonDemo() {
  return (
    <>
      <DemoLead>A pulsing placeholder block matching the shape of the loading content — for genuinely slow loads.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="w-full gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
