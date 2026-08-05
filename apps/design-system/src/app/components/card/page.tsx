import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function CardPage() {
  return (
    <div>
      <DocTitle>Card</DocTitle>
      <DocLead>The default container for grouped content — 12px radius, 1px border, no shadow.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<Card>
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
    </div>
  );
}
