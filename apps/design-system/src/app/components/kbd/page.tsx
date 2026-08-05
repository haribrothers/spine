import { Kbd } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function KbdPage() {
  return (
    <div>
      <DocTitle>Kbd</DocTitle>
      <DocLead>A keyboard-shortcut hint — e.g. the ⌘K search trigger in this design system's own top bar.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Renders a semantic <kbd> element with the library's mono-data styling."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Kbd } from "@spine/ui";

export default () => <Kbd>⌘K</Kbd>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <kbd> attributes" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Kbd>⌘K</Kbd>`}>
          <Kbd>⌘K</Kbd>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Uses the semantic{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<kbd>"}</code>{" "}
          element so assistive technology can identify it as a keyboard input representation.
        </DocLead>
      </DocSection>
    </div>
  );
}
