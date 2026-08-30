import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../src/components/doc-page";

export function TokensScreen() {
  return (
    <DocScreen>
      <DocTitle>Foundation</DocTitle>
      <DocLead>
        Color, typography, spacing, and icon tokens that back every @spine/ui-native component — the same design
        language apps/design-system documents for web, expressed as NativeWind theme tokens here instead of CSS
        custom properties.
      </DocLead>

      <DocSection title="Coming soon">
        <DocLead>
          Dedicated token reference pages (Color, Typography, Spacing, Icons) will land here, mirroring
          apps/design-system&apos;s Foundation section.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
