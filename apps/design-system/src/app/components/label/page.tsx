import { Input, Label } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function LabelPage() {
  return (
    <div>
      <DocTitle>Label</DocTitle>
      <DocLead>
        Renders an accessible label associated with a control. The standalone primitive
        FormField composes internally — reach for FormField in almost every real screen rather
        than pairing Label and a control by hand, since FormField also wires up helper/error
        text and aria-describedby.
      </DocLead>

      <ComponentPreview>
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="contact-name-demo">Contact name</Label>
          <Input id="contact-name-demo" placeholder="Acme Contracting Ltd." />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Clicking the label focuses the associated control, same as a native <label>.",
            "Text selection is prevented on double-click, matching native label behavior.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Label } from "@spine/ui";

export default () => (
  <>
    <Label htmlFor="name" />
    <input id="name" />
  </>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "htmlFor", type: "string" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Label htmlFor="contact-name">Contact name</Label>
<Input id="contact-name" placeholder="Acme Contracting Ltd." />`}
        >
          <div className="flex w-64 flex-col gap-1.5">
            <Label htmlFor="contact-name-demo">Contact name</Label>
            <Input id="contact-name-demo" placeholder="Acme Contracting Ltd." />
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Always pair with a control via matching <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">htmlFor</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">id</code> —
          never rely on placeholder text as a substitute for a real label.
        </DocLead>
      </DocSection>
    </div>
  );
}
