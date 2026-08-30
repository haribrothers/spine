import { View } from "react-native";
import { Button } from "@spine/ui-native";
import { DocScreen, DocSection } from "../../src/components/doc-section";

export function ButtonScreen() {
  return (
    <DocScreen>
      <DocSection title="Variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </DocSection>

      <DocSection title="Sizes">
        <Button size="default">Default</Button>
        <Button size="sm">Small</Button>
        <Button size="touch">Touch (44px, mobile default)</Button>
        <View className="flex-row">
          <Button size="icon">+</Button>
        </View>
      </DocSection>

      <DocSection title="States">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </DocSection>
    </DocScreen>
  );
}
