import { Box, Grid } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function GridPage() {
  return (
    <div>
      <DocTitle>Grid</DocTitle>
      <DocLead>
        CSS grid with a fixed columns count (1–6); pair with Tailwind's responsive prefixes via
        className for responsive column counts.
      </DocLead>

      <ComponentPreview>
        <Grid columns={3} gap="sm" className="w-64">
          {[1, 2, 3].map((n) => (
            <Box key={n} p="sm" className="rounded-md border border-border text-center text-[13px] text-on-surface">
              {n}
            </Box>
          ))}
        </Grid>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "columns takes a fixed 1–6 count, matching literal Tailwind grid-cols-* classes.",
            "gap is mapped to the spacing scale rather than an arbitrary pixel value.",
            "Use className with Tailwind's responsive prefixes (e.g. md:grid-cols-4) for responsive column counts.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Grid, Box } from "@spine/ui";

export default () => (
  <Grid columns={3} gap="sm">
    <Box>1</Box>
    <Box>2</Box>
    <Box>3</Box>
  </Grid>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "columns", type: "1 | 2 | 3 | 4 | 5 | 6", defaultValue: "1" },
            { prop: "gap", type: "none | xs | sm | md | lg | xl | 2xl" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
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

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely a layout primitive — no semantics of its own. Renders a plain div.</DocLead>
      </DocSection>
    </div>
  );
}
