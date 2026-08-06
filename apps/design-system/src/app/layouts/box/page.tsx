import { Box } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function BoxPage() {
  return (
    <div>
      <DocTitle>Box</DocTitle>
      <DocLead>
        The base layout primitive — a plain element with a p (padding) shorthand mapped to the
        spacing scale. Flex, Grid, Container, and Section all compose it.
      </DocLead>

      <ComponentPreview>
        <Box p="md" className="w-fit rounded-md border border-border text-[13px] text-on-surface">
          Content
        </Box>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A single p prop mapped to the spacing scale, instead of a raw Tailwind padding class.",
            "Renders a plain div — no layout behavior of its own beyond padding.",
            "Accepts every standard div prop (className, onClick, etc.) alongside p.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Box } from "@spine/ui";

export default () => <Box p="md">Content</Box>;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "p", type: "none | xs | sm | md | lg | xl | 2xl" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Box p="md" className="rounded-md border border-border">Content</Box>`}>
          <Box p="md" className="w-fit rounded-md border border-border text-[13px] text-on-surface">
            Content
          </Box>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely a layout primitive — no semantics of its own. Renders a plain div.</DocLead>
      </DocSection>
    </div>
  );
}
