import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../src/components/doc-page";

export function SampleScreensScreen() {
  return (
    <DocScreen>
      <DocTitle>Templates</DocTitle>
      <DocLead>
        End-to-end example screens composed from @spine/ui-native components — the native equivalent of
        apps/design-system&apos;s Templates section (e.g. its Admin dashboard sample).
      </DocLead>

      <DocSection title="Coming soon">
        <DocLead>No sample screens are built yet. This section will hold full-screen composed examples.</DocLead>
      </DocSection>
    </DocScreen>
  );
}
