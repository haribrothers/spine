import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";
import { ColorSwatchGrid } from "../../src/components/color-swatch-grid";

export function ColorScreen() {
  return (
    <DocScreen>
      <DocTitle>Color</DocTitle>
      <DocLead>
        The palette is deliberately restrained: one accent color (primary) for interactive elements, a warm neutral
        scale for everything structural, and a reserved four-color semantic palette for financial document status
        that is never repurposed for anything else. Toggle the theme switcher to see the dark-mode values below.
      </DocLead>

      <DocSection title="Primary">
        <DocLead>
          The single accent for buttons, active navigation state, and focus rings. Reserved for one primary action
          per screen.
        </DocLead>
        <ColorSwatchGrid
          swatches={[
            { name: "Primary", token: "primary" },
            { name: "Primary hover", token: "primaryHover" },
          ]}
        />
      </DocSection>

      <DocSection title="Neutrals">
        <DocLead>A warm-leaning stone scale rather than a cool blue-grey, matching web&apos;s @spine/ui exactly.</DocLead>
        <ColorSwatchGrid
          swatches={[
            { name: "Neutral 50", token: "neutral50" },
            { name: "Neutral 100", token: "neutral100" },
            { name: "Neutral 200", token: "neutral200" },
            { name: "Neutral 300", token: "neutral300" },
            { name: "Neutral 500", token: "neutral500" },
            { name: "Neutral 700", token: "neutral700" },
            { name: "Neutral 900", token: "neutral900" },
          ]}
        />
      </DocSection>

      <DocSection title="Surfaces">
        <ColorSwatchGrid
          swatches={[
            { name: "Background", token: "background" },
            { name: "Surface", token: "surface" },
            { name: "Surface sunken", token: "surfaceSunken" },
            { name: "Border", token: "border" },
            { name: "Border strong", token: "borderStrong" },
          ]}
        />
      </DocSection>

      <DocSection title="Financial status (reserved)">
        <DocLead>
          These four map directly to invoice/quote/job status wherever they appear, and are never used for anything
          else. A re-themed primary color must never collide with these.
        </DocLead>
        <ColorSwatchGrid
          swatches={[
            { name: "Paid", token: "paid" },
            { name: "Paid background", token: "paidBg" },
            { name: "Due soon", token: "dueSoon" },
            { name: "Due soon background", token: "dueSoonBg" },
            { name: "Overdue", token: "overdue" },
            { name: "Overdue background", token: "overdueBg" },
            { name: "Draft", token: "draft" },
            { name: "Draft background", token: "draftBg" },
          ]}
        />
      </DocSection>

      <DocSection title="Where these live">
        <DocLead>
          Ported by hand from packages/config/tailwind-preset.css into packages/ui-native/src/tokens/colors.ts —
          React Native has no CSS custom properties, so NativeWind needs plain color values instead of var()
          references. Every themed className in this app pairs a light class with an explicit dark: variant
          (e.g. bg-surface dark:bg-surface-dark) — there&apos;s no automated check that a pair was added, so this stays a
          discipline rule when adding new screens.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
