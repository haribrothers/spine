import { ScrollArea } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ScrollAreaPage() {
  return (
    <div>
      <DocTitle>ScrollArea</DocTitle>
      <DocLead>
        Augments native scroll functionality for custom, cross-browser styling. Thin, bordered
        thumb, no native OS chrome — for any internally-scrolling panel (a long SideNav list, a
        code block).
      </DocLead>

      <ComponentPreview>
        <ScrollArea className="h-40 w-64 rounded-md border border-border p-3">
          <div className="space-y-2 text-[13px] text-on-surface">
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i}>Line item {i + 1}</p>
            ))}
          </div>
        </ScrollArea>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Cross-browser consistent scrollbar styling.", "Scrollbars only appear when needed / on hover, matching each OS's own convention where relevant."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { ScrollArea } from "@spine/ui";

export default () => <ScrollArea className="h-48">…tall content…</ScrollArea>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div> attributes on the root" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<ScrollArea className="h-40 w-64 rounded-md border border-border p-3">…tall content…</ScrollArea>`}>
          <ScrollArea className="h-40 w-64 rounded-md border border-border p-3">
            <div className="space-y-2 text-[13px] text-on-surface">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i}>Line item {i + 1}</p>
              ))}
            </div>
          </ScrollArea>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Preserves native scroll and keyboard behavior — arrow keys, Page Up/Down, and Home/End all work as expected within the viewport.</DocLead>
      </DocSection>
    </div>
  );
}
