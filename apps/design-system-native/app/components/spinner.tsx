import { View } from "react-native";
import { Spinner } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function SpinnerScreen() {
  return (
    <DocScreen>
      <DocTitle>Spinner</DocTitle>
      <DocLead>
        An indeterminate loading indicator for actions with no known duration — e.g. &quot;sending invoice…&quot;.
        Prefer a skeleton-shaped placeholder for content that has a known shape, once this package has one.
      </DocLead>

      <ComponentPreview>
        <View className="flex-row items-center gap-4">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Three sizes: sm, md, lg — approximated via a transform: scale() on top of RN's own small/large ActivityIndicator sizes, since RN has no arbitrary pixel size the way web's Lucide-based spinner does.",
            "The same ActivityIndicator + theme-aware color resolution Button's own loading state already relies on, extracted into its own component now that a second, non-Button use needs it.",
            "accessibilityRole=\"alert\" + accessibilityLiveRegion=\"polite\" — the RN equivalent of web's role=\"status\" span, so assistive tech gets a polite announcement without focus moving anywhere.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Spinner } from "@spine/ui-native";

<Spinner />;
<Spinner label="Issuing invoice…" />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "size", type: "sm | md | lg", defaultValue: "md" },
            { prop: "label", type: "string", defaultValue: '"Loading"' },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Sizes</DocLead>
        <ComponentPreview code={`<Spinner size="sm" />\n<Spinner size="md" />\n<Spinner size="lg" />`}>
          <View className="flex-row items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Announces &quot;Loading&quot; by default via accessibilityLabel + a polite live region — pass a more
          specific label (e.g. &quot;Sending invoice…&quot;) where useful, so assistive tech users learn something
          is in progress without focus moving anywhere.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
