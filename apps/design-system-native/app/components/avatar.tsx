import { View } from "react-native";
import { Avatar } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function AvatarScreen() {
  return (
    <DocScreen>
      <DocTitle>Avatar</DocTitle>
      <DocLead>
        A circular image with a fallback for representing a user or organization — initials on a primary-color fill
        by default, or an image when available.
      </DocLead>

      <ComponentPreview>
        <View className="flex-row items-center gap-3">
          <Avatar size="sm" fallback="JD" />
          <Avatar size="md" fallback="JD" />
          <Avatar size="lg" fallback="JD" />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Automatic fallback to initials if an image source is missing or fails to load (RN's Image onError, the equivalent of web's Radix load-failure behavior).",
            "Three sizes: sm, md, lg.",
            "No compound Root/Image/Fallback API like web — there's no Radix primitive being wrapped here, so it collapses to plain source/fallback props on one component.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Avatar } from "@spine/ui-native";

<Avatar fallback="JD" />;
<Avatar source={{ uri: "https://…" }} fallback="JD" />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "size", type: "sm | md | lg", defaultValue: "md" },
            { prop: "source", type: "ImageSourcePropType" },
            { prop: "fallback", type: "string" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Sizes</DocLead>
        <ComponentPreview
          code={`<Avatar size="sm" fallback="JD" />
<Avatar size="md" fallback="JD" />
<Avatar size="lg" fallback="JD" />`}
        >
          <View className="flex-row items-center gap-3">
            <Avatar size="sm" fallback="JD" />
            <Avatar size="md" fallback="JD" />
            <Avatar size="lg" fallback="JD" />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          The fallback initials render as visible text, so a screen reader announces them by default. Pass an
          accessibilityLabel with the person&apos;s full name when a real image is used — initials alone aren&apos;t
          a substitute for it.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
