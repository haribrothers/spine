import { Button } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { ApiTable, DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function ButtonPage() {
  return (
    <div>
      <DocTitle>Button</DocTitle>
      <DocLead>
        Triggers an action. One primary (filled) action per screen — everything else is
        secondary, ghost, or a plain link.
      </DocLead>

      <DocSection id="variants" title="Variants">
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
      </DocSection>

      <DocSection id="sizes" title="Sizes">
        <DocLead>
          <code className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
            touch
          </code>{" "}
          meets the 44px minimum required for the mobile field-companion app.
        </DocLead>
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
      </DocSection>

      <DocSection id="disabled" title="Disabled">
        <DocLead>
          Disabled buttons use the border color rather than a dimmed fill, so they stay
          unambiguous in bright light.
        </DocLead>
        <ComponentPreview code={`<Button disabled>Save invoice</Button>`}>
          <Button disabled>Save invoice</Button>
        </ComponentPreview>
      </DocSection>

      <DocSection id="api" title="API">
        <ApiTable
          rows={[
            { prop: "variant", type: "primary | secondary | danger | ghost", defaultValue: "primary" },
            { prop: "size", type: "default | sm | touch | icon", defaultValue: "default" },
            { prop: "asChild", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>
    </div>
  );
}
