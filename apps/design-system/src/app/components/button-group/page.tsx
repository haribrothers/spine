import { Button, ButtonGroup } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ButtonGroupPage() {
  return (
    <div>
      <DocTitle>ButtonGroup</DocTitle>
      <DocLead>A row of related Buttons with joined edges — e.g. a view-switcher that isn't a Tabs navigation.</DocLead>

      <ComponentPreview>
        <ButtonGroup>
          <Button variant="secondary">List</Button>
          <Button variant="secondary">Board</Button>
          <Button variant="secondary">Calendar</Button>
        </ButtonGroup>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Automatically joins the edges of adjacent Button children via CSS, no per-child prop needed."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { ButtonGroup, Button } from "@spine/ui";

export default () => (
  <ButtonGroup>
    <Button variant="secondary">List</Button>
    <Button variant="secondary">Board</Button>
  </ButtonGroup>
);`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div> attributes" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<ButtonGroup>
  <Button variant="secondary">List</Button>
  <Button variant="secondary">Board</Button>
  <Button variant="secondary">Calendar</Button>
</ButtonGroup>`}
        >
          <ButtonGroup>
            <Button variant="secondary">List</Button>
            <Button variant="secondary">Board</Button>
            <Button variant="secondary">Calendar</Button>
          </ButtonGroup>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Rendered with <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">role=&quot;group&quot;</code>{" "}
          so screen readers announce the buttons as a related set.
        </DocLead>
      </DocSection>
    </div>
  );
}
