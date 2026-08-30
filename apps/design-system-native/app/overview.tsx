import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../src/components/doc-page";

export function IntroductionScreen() {
  return (
    <DocScreen>
      <DocTitle>Overview</DocTitle>
      <DocLead>
        This app documents @spine/ui-native, the React Native component library shared by apps/mobile and any
        future native Spine app. It mirrors apps/design-system&apos;s Overview/Foundation/Layouts/Components/Templates
        structure, rendered with React Native primitives instead of DOM.
      </DocLead>

      <DocSection title="Coming soon">
        <DocLead>
          Principles and getting-started content will land here as the native component library grows past its
          current small set. See the Components tab for what&apos;s documented today.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
