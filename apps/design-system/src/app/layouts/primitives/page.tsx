import { Box, Flex, Grid } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function LayoutPrimitivesPage() {
  return (
    <div>
      <DocTitle>Box, Flex, Grid, Container, Section</DocTitle>
      <DocLead>
        Five composable primitives underlie every page's structure — real `@spine/ui`
        components, not just documentation conventions, so app code can build layout from typed
        props instead of hand-rolled Tailwind class strings.
      </DocLead>

      <DocSection id="box" title="Box">
        <DocLead>The base primitive — a plain element with a p (padding) shorthand mapped to the spacing scale. Everything below composes it.</DocLead>
        <ApiTable rows={[{ prop: "p", type: "none | xs | sm | md | lg | xl | 2xl" }]} />
        <ComponentPreview code={`<Box p="md" className="rounded-md border border-border">Content</Box>`}>
          <Box p="md" className="w-fit rounded-md border border-border text-[13px] text-on-surface">
            Content
          </Box>
        </ComponentPreview>
      </DocSection>

      <DocSection id="flex" title="Flex">
        <DocLead>Flexbox layout — direction/align/justify/wrap/gap props, gap mapped to the spacing scale.</DocLead>
        <ApiTable
          rows={[
            { prop: "direction", type: "row | column", defaultValue: "row" },
            { prop: "align", type: "start | center | end | stretch | baseline" },
            { prop: "justify", type: "start | center | end | between | around" },
            { prop: "wrap", type: "boolean", defaultValue: "false" },
            { prop: "gap", type: "none | xs | sm | md | lg | xl | 2xl" },
          ]}
        />
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

      <DocSection id="grid" title="Grid">
        <DocLead>CSS grid with a fixed columns count (1–6); pair with Tailwind's responsive prefixes via className for responsive column counts.</DocLead>
        <ApiTable
          rows={[
            { prop: "columns", type: "1 | 2 | 3 | 4 | 5 | 6", defaultValue: "1" },
            { prop: "gap", type: "none | xs | sm | md | lg | xl | 2xl" },
          ]}
        />
        <ComponentPreview
          code={`<Grid columns={3} gap="sm">
  <Box p="sm" className="rounded-md border border-border">1</Box>
  <Box p="sm" className="rounded-md border border-border">2</Box>
  <Box p="sm" className="rounded-md border border-border">3</Box>
</Grid>`}
        >
          <Grid columns={3} gap="sm" className="w-64">
            {[1, 2, 3].map((n) => (
              <Box key={n} p="sm" className="rounded-md border border-border text-center text-[13px] text-on-surface">
                {n}
              </Box>
            ))}
          </Grid>
        </ComponentPreview>
      </DocSection>

      <DocSection id="container" title="Container">
        <DocLead>Centers content and caps it at the container-max token (1200px), with the standard margin-desktop/margin-mobile horizontal padding.</DocLead>
        <CodeBlock code={`import { Container } from "@spine/ui";

export default () => <Container>Page content, capped at 1200px.</Container>;`} />
      </DocSection>

      <DocSection id="section" title="Section">
        <DocLead>A vertical page section — generous top/bottom padding at one of four sizes; pair with Container for horizontal constraint.</DocLead>
        <ApiTable rows={[{ prop: "size", type: "sm | md | lg | xl", defaultValue: "md" }]} />
        <CodeBlock
          code={`import { Section, Container } from "@spine/ui";

export default () => (
  <Section size="lg">
    <Container>Section content.</Container>
  </Section>
);`}
        />
      </DocSection>
    </div>
  );
}
