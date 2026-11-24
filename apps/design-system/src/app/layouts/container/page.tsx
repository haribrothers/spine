import { Container } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ContainerPage() {
  return (
    <div>
      <DocTitle>Container</DocTitle>
      <DocLead>
        Centers content and caps it at the container-max token (1200px), with the standard
        margin-desktop/margin-mobile horizontal padding.
      </DocLead>

      <ComponentPreview>
        <div className="w-full">
          <Container className="border border-dashed border-border-strong bg-surface py-3 text-center text-[13px] text-on-surface">
            Content, centered and capped at 1200px.
          </Container>
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Caps content width at 1200px and centers it with automatic left/right margins.",
            "Applies the standard responsive horizontal padding (16px mobile, 32px desktop) automatically.",
            "Pair with Section for the vertical padding half of page structure.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Container } from "@spine/ui";

export default () => <Container>Page content, capped at 1200px.</Container>;`} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Container className="border border-dashed border-border-strong">
  Content, centered and capped at 1200px.
</Container>`}
        >
          <div className="w-full">
            <Container className="border border-dashed border-border-strong bg-surface py-3 text-center text-[13px] text-on-surface">
              Content, centered and capped at 1200px.
            </Container>
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely a layout primitive — no semantics of its own. Renders a plain div.</DocLead>
      </DocSection>
    </div>
  );
}
