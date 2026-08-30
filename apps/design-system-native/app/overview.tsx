import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList } from "../src/components/doc-page";
import { CodeBlock } from "../src/components/code-block";

export function IntroductionScreen() {
  return (
    <DocScreen>
      <DocTitle>Spine UI Native</DocTitle>
      <DocLead>
        Spine replaces the patchwork a small contractor or design studio already runs on — WhatsApp for contacts,
        Excel for quotes, a shoebox for receipts — with one tool that follows their actual workflow: enquiry, quote,
        job, invoice, payment, books. A correct double-entry ledger runs invisibly underneath every screen, on mobile
        as much as on web.
      </DocLead>
      <DocLead>
        This app is the reference for @spine/ui-native, the React Native component library apps/mobile (and any
        future native Spine app) is built from — the native counterpart to @spine/ui on web, sharing the same design
        tokens and, wherever the platforms allow it, the same visual language.
      </DocLead>

      <DocSection title="Who this is for">
        <DocLead>
          If you&apos;re building a screen inside apps/mobile, or contributing to @spine/ui-native itself, this app is
          where you start — not by reverse-engineering props from component source. Every component page shows its
          full API, a working example, and the accessibility behavior it exposes.
        </DocLead>
      </DocSection>

      <DocSection title="Getting started">
        <DocLead>Install the package inside the monorepo:</DocLead>
        <CodeBlock code="pnpm add @spine/ui-native --filter your-app" />

        <DocLead>
          Import components directly — there is no build step for @spine/ui-native, it&apos;s consumed as TypeScript
          source across the workspace, the same way every other internal package in the monorepo works:
        </DocLead>
        <CodeBlock
          code={`import { Button } from "@spine/ui-native";

export function Example() {
  return <Button variant="primary">Save invoice</Button>;
}`}
        />

        <DocLead>
          Every component reads its colors and spacing from NativeWind theme tokens defined in each app&apos;s
          tailwind.config.js — nothing is hardcoded inline. Colors are registered twice per app (once for light, once
          under a `-dark` suffix for dark mode) so the runtime theme toggle can switch between them.
        </DocLead>
      </DocSection>

      <DocSection title="What's here">
        <FeatureList
          items={[
            "Foundation — the raw design tokens: color, typography, spacing, icons. Read this before building a new component, since every value here should already exist as a token.",
            "Layouts — structural primitives and navigation shells (tab bars, stack headers) every native screen composes from.",
            "Components — the full @spine/ui-native catalogue.",
            "Templates — full sample screens composed from real components, showing how the pieces fit together in an actual Spine screen rather than in isolation.",
          ]}
        />
        <DocLead>See the Principles tab next for the rules every component and screen in Spine follows.</DocLead>
      </DocSection>
    </DocScreen>
  );
}
