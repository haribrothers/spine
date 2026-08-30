import { View } from "react-native";
import { Badge } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function BadgeScreen() {
  return (
    <DocScreen>
      <DocTitle>Badge</DocTitle>
      <DocLead>
        A compact neutral-toned indicator for counts/tags/generic status. Never used for financial status — that
        stays a native StatusChip&apos;s reserved semantic whenever one is built.
      </DocLead>

      <ComponentPreview>
        <View className="flex-row items-center gap-3">
          <Badge>Beta</Badge>
          <Badge>12</Badge>
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList items={["Single neutral tone, no status-color variants — that's what a native StatusChip is for."]} />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Badge } from "@spine/ui-native";

<Badge>Beta</Badge>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard TextProps" }]} />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Badge>Beta</Badge>\n<Badge>12</Badge>`}>
          <View className="flex-row items-center gap-3">
            <Badge>Beta</Badge>
            <Badge>12</Badge>
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>Purely decorative/informational — no interactive semantics.</DocLead>
      </DocSection>
    </DocScreen>
  );
}
