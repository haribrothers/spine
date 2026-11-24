import { Container, Section } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function SectionPage() {
  return (
    <div>
      <DocTitle>Section</DocTitle>
      <DocLead>
        A vertical page section — generous top/bottom padding at one of four sizes; pair with
        Container for horizontal constraint.
      </DocLead>

      <ComponentPreview>
        <Section size="sm" className="w-full border border-dashed border-border-strong bg-surface">
          <Container className="text-center text-[13px] text-on-surface">Section content.</Container>
        </Section>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "size selects one of four vertical-padding presets (sm/md/lg/xl) instead of a raw py-* class.",
            "Renders a semantic <section> element.",
            "Pair with Container inside it for the standard page-section shape (vertical + horizontal constraint).",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Section, Container } from "@spine/ui";

export default () => (
  <Section size="lg">
    <Container>Section content.</Container>
  </Section>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "size", type: "sm | md | lg | xl", defaultValue: "md" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Section size="sm" className="border border-dashed border-border-strong">
  <Container>Section content.</Container>
</Section>`}
        >
          <Section size="sm" className="w-full border border-dashed border-border-strong bg-surface">
            <Container className="text-center text-[13px] text-on-surface">Section content.</Container>
          </Section>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Renders a semantic {"<section>"} element — no other ARIA semantics of its own.</DocLead>
      </DocSection>
    </div>
  );
}
