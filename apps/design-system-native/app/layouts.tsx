import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../src/components/doc-page";

export function AppShellScreen() {
  return (
    <DocScreen>
      <DocTitle>Layouts</DocTitle>
      <DocLead>
        Structural primitives for composing screens — the native equivalent of apps/design-system&apos;s
        Box/Flex/Grid/Container/Section primitives and AppShell layout.
      </DocLead>

      <DocSection title="Coming soon">
        <DocLead>
          @spine/ui-native doesn&apos;t yet have dedicated layout primitives beyond plain View/Flex usage — this
          section will document them as they&apos;re added.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
