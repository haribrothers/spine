import { Badge } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function BadgePage() {
  return (
    <div>
      <DocTitle>Badge</DocTitle>
      <DocLead>
        A compact neutral-toned indicator for counts/tags/generic status. Visually similar to
        StatusChip but never used for financial status, which stays StatusChip's reserved
        semantic.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Single neutral tone, no status-color variants — that's what StatusChip is for."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Badge } from "@spine/ui";

export default () => <Badge>Beta</Badge>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <span> attributes" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Badge>Beta</Badge>\n<Badge>12</Badge>`}>
          <div className="flex items-center gap-3">
            <Badge>Beta</Badge>
            <Badge>12</Badge>
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely decorative/informational — no interactive semantics.</DocLead>
      </DocSection>
    </div>
  );
}
