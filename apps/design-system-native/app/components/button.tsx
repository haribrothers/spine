import { View } from "react-native";
import { Button } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function ButtonScreen() {
  return (
    <DocScreen>
      <DocTitle>Button</DocTitle>
      <DocLead>
        Triggers an action or event. One primary (filled) action per screen — everything else is secondary, ghost,
        or a plain link.
      </DocLead>

      <ComponentPreview>
        <View className="flex-row flex-wrap items-center gap-3">
          <Button variant="primary">Save invoice</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Void invoice</Button>
          <Button variant="ghost">Dismiss</Button>
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Renders RN's Pressable/Text, styled via NativeWind className, not StyleSheet.",
            "Four visual variants: primary, secondary, danger, ghost.",
            "Four sizes, including a 44px touch size — the default here, since this is a field-companion app.",
            "accessibilityRole and accessibilityState (disabled/busy) set automatically.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Button } from "@spine/ui-native";

<Button onPress={...}>Save invoice</Button>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: "primary | secondary | danger | ghost", defaultValue: "primary" },
            { prop: "size", type: "default | sm | touch | icon", defaultValue: "touch" },
            { prop: "loading", type: "boolean", defaultValue: "false" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Variants</DocLead>
        <ComponentPreview
          code={`<Button variant="primary">Save invoice</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Void invoice</Button>
<Button variant="ghost">Dismiss</Button>`}
        >
          <View className="flex-row flex-wrap items-center gap-3">
            <Button variant="primary">Save invoice</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="danger">Void invoice</Button>
            <Button variant="ghost">Dismiss</Button>
          </View>
        </ComponentPreview>

        <DocLead>Sizes</DocLead>
        <ComponentPreview
          code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="touch">Touch (44px)</Button>`}
        >
          <View className="flex-row flex-wrap items-center gap-3">
            <Button>Small</Button>
            <Button>Default</Button>
            <Button>Touch (44px)</Button>
          </View>
        </ComponentPreview>

        <DocLead>States</DocLead>
        <ComponentPreview
          code={`<Button disabled>Disabled</Button>
<Button loading>Loading</Button>`}
        >
          <View className="flex-row flex-wrap items-center gap-3">
            <Button disabled>Disabled</Button>
            <Button disabled>Loading</Button>
          </View>
        </ComponentPreview>
      </DocSection>
    </DocScreen>
  );
}
