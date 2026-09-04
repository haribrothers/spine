import { Text } from "react-native";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Button } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function CardScreen() {
  return (
    <DocScreen>
      <DocTitle>Card</DocTitle>
      <DocLead>The default container for grouped content — 8px radius, 1px border, no shadow.</DocLead>

      <ComponentPreview>
        <Card className="w-full max-w-80">
          <CardHeader>
            <CardTitle>Invoice INV-2026-0042</CardTitle>
            <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Acme Contracting Ltd. — $1,240.00</Text>
          </CardContent>
          <CardFooter>
            <Button>View</Button>
          </CardFooter>
        </Card>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={["Composable sub-parts (Header, Title, Description, Content, Footer) — use only the ones a given card needs."]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@spine/ui-native";

<Card>
  <CardHeader>
    <CardTitle />
    <CardDescription />
  </CardHeader>
  <CardContent />
  <CardFooter />
</Card>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard ViewProps/TextProps on every sub-part" }]} />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Card>
  <CardHeader>
    <CardTitle>Invoice INV-2026-0042</CardTitle>
    <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
  </CardHeader>
  <CardContent>
    <Text>Acme Contracting Ltd. — $1,240.00</Text>
  </CardContent>
  <CardFooter>
    <Button size="sm">View</Button>
  </CardFooter>
</Card>`}
        >
          <Card className="w-full max-w-80">
            <CardHeader>
              <CardTitle>Invoice INV-2026-0042</CardTitle>
              <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Acme Contracting Ltd. — $1,240.00</Text>
            </CardContent>
            <CardFooter>
              <Button>View</Button>
            </CardFooter>
          </Card>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>A plain grouping container with no interactive semantics of its own.</DocLead>
      </DocSection>
    </DocScreen>
  );
}
