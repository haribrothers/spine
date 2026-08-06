import { Box, Flex } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function FlexPage() {
  return (
    <div>
      <DocTitle>Flex</DocTitle>
      <DocLead>
        Flexbox layout — direction/align/justify/wrap/gap props, gap mapped to the spacing scale,
        instead of hand-rolled Tailwind flex utility strings.
      </DocLead>

      <ComponentPreview>
        <Flex gap="sm" align="center">
          <Box p="sm" className="rounded-md border border-border text-[13px] text-on-surface">
            A
          </Box>
          <Box p="sm" className="rounded-md border border-border text-[13px] text-on-surface">
            B
          </Box>
        </Flex>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "direction, align, justify, wrap, and gap props cover the common flexbox cases.",
            "gap is mapped to the spacing scale rather than an arbitrary pixel value.",
            "Falls back to plain Tailwind flex-* utilities via className for anything not covered.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Flex, Box } from "@spine/ui";

export default () => (
  <Flex gap="sm" align="center">
    <Box>A</Box>
    <Box>B</Box>
  </Flex>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "direction", type: "row | column", defaultValue: "row" },
            { prop: "align", type: "start | center | end | stretch | baseline" },
            { prop: "justify", type: "start | center | end | between | around" },
            { prop: "wrap", type: "boolean", defaultValue: "false" },
            { prop: "gap", type: "none | xs | sm | md | lg | xl | 2xl" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Flex gap="sm" align="center">
  <Box p="sm" className="rounded-md border border-border">A</Box>
  <Box p="sm" className="rounded-md border border-border">B</Box>
</Flex>`}
        >
          <Flex gap="sm" align="center">
            <Box p="sm" className="rounded-md border border-border text-[13px] text-on-surface">
              A
            </Box>
            <Box p="sm" className="rounded-md border border-border text-[13px] text-on-surface">
              B
            </Box>
          </Flex>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely a layout primitive — no semantics of its own. Renders a plain div.</DocLead>
      </DocSection>
    </div>
  );
}
