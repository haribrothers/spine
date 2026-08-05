import { Separator } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function SeparatorPage() {
  return (
    <div>
      <DocTitle>Separator</DocTitle>
      <DocLead>
        Visually or semantically separates content. A 1px border-colored rule, horizontal or
        vertical, for separating sections within a card or toolbar without a full card
        boundary.
      </DocLead>

      <ComponentPreview>
        <div className="w-64">
          <Separator />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Supports horizontal and vertical orientation.", "Decorative by default (hidden from assistive tech) since it's usually a visual-only divider."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Separator } from "@spine/ui";

export default () => <Separator />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "orientation", type: "horizontal | vertical", defaultValue: "horizontal" },
            { prop: "decorative", type: "boolean", defaultValue: "true" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Horizontal</DocLead>
        <ComponentPreview code={`<Separator />`}>
          <div className="w-64">
            <Separator />
          </div>
        </ComponentPreview>

        <DocLead>Vertical</DocLead>
        <ComponentPreview code={`<div className="flex h-6 items-center gap-3">\n  <span>Draft</span>\n  <Separator orientation="vertical" />\n  <span>Edit</span>\n</div>`}>
          <div className="flex h-6 items-center gap-3 text-[13px] text-on-surface">
            <span>Draft</span>
            <Separator orientation="vertical" />
            <span>Edit</span>
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Set <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">decorative={"{false}"}</code>{" "}
          if the separator carries real semantic meaning (e.g. between distinct document sections a
          screen reader user should be able to navigate by).
        </DocLead>
      </DocSection>
    </div>
  );
}
