import { InputGroup, InputGroupAddon, InputGroupInput } from "@spine/ui";
import { Search } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function InputGroupPage() {
  return (
    <div>
      <DocTitle>InputGroup</DocTitle>
      <DocLead>
        Wraps an Input with a leading/trailing icon or addon — e.g. SearchInput's leading
        search icon, or a trailing currency-code addon.
      </DocLead>

      <ComponentPreview>
        <InputGroup className="w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search invoices…" />
        </InputGroup>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["The focus ring applies to the whole group, not just the inner input, so it reads as one control."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { InputGroup, InputGroupAddon, InputGroupInput } from "@spine/ui";

export default () => (
  <InputGroup>
    <InputGroupAddon />
    <InputGroupInput />
  </InputGroup>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div>/<input> attributes on the respective sub-parts" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Leading icon (SearchInput)</DocLead>
        <ComponentPreview
          code={`<InputGroup className="w-64">
  <InputGroupAddon><Search /></InputGroupAddon>
  <InputGroupInput placeholder="Search invoices…" />
</InputGroup>`}
        >
          <InputGroup className="w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search invoices…" />
          </InputGroup>
        </ComponentPreview>

        <DocLead>Trailing addon</DocLead>
        <ComponentPreview
          code={`<InputGroup className="w-40">
  <InputGroupInput placeholder="1,240.00" />
  <InputGroupAddon>USD</InputGroupAddon>
</InputGroup>`}
        >
          <InputGroup className="w-40">
            <InputGroupInput placeholder="1,240.00" />
            <InputGroupAddon>USD</InputGroupAddon>
          </InputGroup>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>The icon/addon is decorative; pair the inner input with a real label via FormField.</DocLead>
      </DocSection>
    </div>
  );
}
