import { AspectRatio } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function AspectRatioPage() {
  return (
    <div>
      <DocTitle>AspectRatio</DocTitle>
      <DocLead>
        Displays content within a desired ratio. Constrains embedded media (job/site photo
        thumbnails) to a fixed ratio so layout doesn't jump before the asset loads.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Accepts any ratio, not just common presets — pass width / height."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { AspectRatio } from "@spine/ui";

export default () => (
  <AspectRatio ratio={16 / 9}>
    <img src="…" />
  </AspectRatio>
);`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "ratio", type: "number", defaultValue: "1" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<AspectRatio ratio={16 / 9} className="w-64 overflow-hidden rounded-md bg-surface-sunken" />`}>
          <AspectRatio ratio={16 / 9} className="w-64 overflow-hidden rounded-md bg-surface-sunken" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely a layout primitive — no semantics of its own; apply alt text to whatever media it wraps.</DocLead>
      </DocSection>
    </div>
  );
}
