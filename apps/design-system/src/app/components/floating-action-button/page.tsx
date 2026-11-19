import { Button, FloatingActionButton } from "@spine/ui";
import { Plus } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function FloatingActionButtonPage() {
  return (
    <div>
      <DocTitle>FloatingActionButton</DocTitle>
      <DocLead>A page&apos;s main action. From 768px up it&apos;s the button where it was; on a phone it floats above the tab bar and shrinks to its icon while the page scrolls (US-OPS-57).</DocLead>

      <ComponentPreview>
        <FloatingActionButton>
          <Button>
            <Plus aria-hidden />
            New invoice
          </Button>
        </FloatingActionButton>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Keeps its label for screen readers when it shrinks.", "Marked data-main-action, so the phone check finds it on the first screen.", "Resize below 768px to see it float."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<FloatingActionButton><Button asChild><Link href="/invoices/new"><Plus />New invoice</Link></Button></FloatingActionButton>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "children", type: "the page's main Button" }]} />
      </DocSection>
    </div>
  );
}
