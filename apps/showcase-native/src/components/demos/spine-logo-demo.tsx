import { View } from "react-native";
import { SpineLogo } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

/** US-MOB-27 — the layered mark and the SPiNE wordmark, drawn from the supplied SVG paths. */
export function SpineLogoDemo() {
  return (
    <>
      <DemoLead>
        The layered mark and the SPiNE wordmark, sharp at any size. The wordmark is primary in light mode and light text in dark mode; the mark&apos;s gradient reads on both.
      </DemoLead>
      <DemoSection title="Forms">
        <DemoPreview>
          <View className="w-full items-center gap-6">
            <SpineLogo variant="vertical" size={132} />
            <SpineLogo variant="horizontal" size={160} />
            <SpineLogo variant="mark" size={48} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Minimum sizes">
        <DemoLead>Never smaller than 20 dp for the mark or 96 dp wide for a lockup.</DemoLead>
        <DemoPreview>
          <View className="flex-row items-center gap-6">
            <SpineLogo variant="mark" size={20} />
            <SpineLogo variant="horizontal" size={96} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Accessibility">
        <DemoLead>
          The logo is one image read as &ldquo;Spine&rdquo;. Pass decorative when the word Spine is already next to it, so a screen reader doesn&apos;t say it twice. Brand colours are for the logo and illustrations only — never text or status.
        </DemoLead>
      </DemoSection>
    </>
  );
}
