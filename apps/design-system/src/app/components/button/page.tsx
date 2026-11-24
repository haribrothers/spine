import { Button } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function ButtonPage() {
  return (
    <div>
      <DocTitle>Button</DocTitle>
      <DocLead>
        Triggers an action or event. One primary (filled) action per screen — everything else
        is secondary, ghost, or a plain link.
      </DocLead>

      <ComponentPreview>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Save invoice</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Void invoice</Button>
          <Button variant="ghost">Dismiss</Button>
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Renders a native <button> or, via asChild, forwards its props onto a single child element (e.g. a Link).",
            "Four visual variants: primary, secondary, danger, ghost. Secondary has a white surface fill, so it reads the same on the page and inside a card; ghost stays transparent.",
            "Four sizes, including a 44px touch size for the mobile field-companion app.",
            "Full keyboard and focus-visible support inherited from the native element.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Button } from "@spine/ui";

export default () => <Button>Save invoice</Button>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: "primary | secondary | danger | ghost", defaultValue: "primary" },
            { prop: "size", type: "default | sm | touch | icon", defaultValue: "default" },
            { prop: "asChild", type: "boolean", defaultValue: "false" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Variants</DocLead>
        <ComponentPreview
          code={`<Button variant="primary">Save invoice</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Void invoice</Button>
<Button variant="ghost">Dismiss</Button>`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Save invoice</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="danger">Void invoice</Button>
            <Button variant="ghost">Dismiss</Button>
          </div>
        </ComponentPreview>

        <DocLead>Sizes</DocLead>
        <ComponentPreview
          code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="touch">Touch (44px)</Button>`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="touch">Touch (44px)</Button>
          </div>
        </ComponentPreview>

        <DocLead>Disabled</DocLead>
        <ComponentPreview code={`<Button disabled>Save invoice</Button>`}>
          <Button disabled>Save invoice</Button>
        </ComponentPreview>

        <DocLead>As a link (asChild)</DocLead>
        <ComponentPreview code={`<Button asChild>\n  <a href="/quotes/new">New quote</a>\n</Button>`}>
          <Button asChild>
            <a href="#">New quote</a>
          </Button>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Uses a native <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<button>"}</code> element by default, so keyboard and screen-reader behavior is inherited directly rather than reimplemented.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Activates the button." },
            { keys: "Enter", description: "Activates the button." },
          ]}
        />
      </DocSection>
    </div>
  );
}
