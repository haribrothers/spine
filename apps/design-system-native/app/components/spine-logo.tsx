import { View } from "react-native";
import { SpineLogo } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function SpineLogoScreen() {
  return (
    <DocScreen>
      <DocTitle>Spine logo</DocTitle>
      <DocLead>
        The layered mark and the SPiNE wordmark, drawn from the supplied SVG paths so they stay sharp at any size. The
        wordmark is primary in light mode and light text in dark mode; the mark&apos;s gradient reads on both.
      </DocLead>

      <ComponentPreview>
        <View className="items-center gap-6">
          <SpineLogo variant="vertical" size={132} />
          <SpineLogo variant="horizontal" size={160} />
          <SpineLogo variant="mark" size={48} />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Three forms: the mark alone, the horizontal lockup (mark beside the wordmark) and the vertical lockup (mark above it).",
            "Follows dark mode: primary wordmark on light, light-text wordmark on dark.",
            "Never smaller than the brand minimum: 20 dp for the mark, 96 dp wide for a lockup.",
            "Brand colours (tokens brandColors) are for the logo and illustrations only — never text or status.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { SpineLogo } from "@spine/ui-native";

<SpineLogo variant="vertical" size={132} />;
<SpineLogo variant="horizontal" size={110} decorative />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: "mark | horizontal | vertical", defaultValue: "mark" },
            { prop: "size", type: "number (dp: the mark's side, or a lockup's width)", defaultValue: "48 / 160" },
            { prop: "decorative", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>The minimum sizes</DocLead>
        <ComponentPreview
          code={`<SpineLogo variant="mark" size={20} />
<SpineLogo variant="horizontal" size={96} />`}
        >
          <View className="flex-row items-center gap-6">
            <SpineLogo variant="mark" size={20} />
            <SpineLogo variant="horizontal" size={96} />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          The logo is one image read as &ldquo;Spine&rdquo;. Pass decorative when the word Spine is already next to it,
          so a screen reader doesn&apos;t say it twice.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
