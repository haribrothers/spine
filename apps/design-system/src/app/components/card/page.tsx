import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function CardPage() {
  return (
    <div>
      <DocTitle>Card</DocTitle>
      <DocLead>The default container for grouped content — 12px radius, 1px border, no shadow.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Composable sub-parts (Header, Title, Description, Content, Footer) — use only the ones a given card needs."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@spine/ui";

export default () => (
  <Card>
    <CardHeader>
      <CardTitle />
      <CardDescription />
    </CardHeader>
    <CardContent />
    <CardFooter />
  </Card>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div> attributes on every sub-part" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Card>
  <CardHeader>
    <CardTitle>Invoice INV-2026-0042</CardTitle>
    <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Acme Contracting Ltd. — $1,240.00</p>
  </CardContent>
  <CardFooter>
    <Button size="sm">View</Button>
  </CardFooter>
</Card>`}
        >
          <Card className="w-80">
            <CardHeader>
              <CardTitle>Invoice INV-2026-0042</CardTitle>
              <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-on-surface-muted">Acme Contracting Ltd. — $1,240.00</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">View</Button>
            </CardFooter>
          </Card>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>A plain grouping container with no interactive semantics of its own.</DocLead>
      </DocSection>
    </div>
  );
}
