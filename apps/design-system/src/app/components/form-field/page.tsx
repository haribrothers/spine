import { FormField, Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function FormFieldPage() {
  return (
    <div>
      <DocTitle>FormField</DocTitle>
      <DocLead>
        Label above, control, helper/error text below — the composition every form control in
        the app should be built from, rather than hand-wiring Label/HelperText/aria attributes
        per screen.
      </DocLead>

      <ComponentPreview>
        <FormField label="Contact name" required className="w-72">
          {(field) => <Input {...field} placeholder="Acme Contracting Ltd." />}
        </FormField>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A render-prop child receives the field's generated id, aria-describedby, aria-invalid, aria-required, and required, ready to spread onto any control.",
            "Automatically links helper or error text to the control via aria-describedby, and sets aria-invalid when errorText is present.",
            "A required prop renders an asterisk after the label (aria-hidden, decorative only) and passes required/aria-required through to the control itself, so requiredness is announced from the control, not just implied by a visual mark.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { FormField, Input } from "@spine/ui";

export default () => (
  <FormField label="Contact name">
    {(field) => <Input {...field} />}
  </FormField>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "label", type: "string" },
            { prop: "helperText", type: "string" },
            { prop: "errorText", type: "string" },
            { prop: "required", type: "boolean", defaultValue: "false" },
            { prop: "children", type: "(field: { id, 'aria-describedby', 'aria-invalid', 'aria-required', required }) => ReactNode" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<FormField label="Contact name" required>
  {(field) => <Input {...field} placeholder="Acme Contracting Ltd." />}
</FormField>`}
        >
          <FormField label="Contact name" required className="w-72">
            {(field) => <Input {...field} placeholder="Acme Contracting Ltd." />}
          </FormField>
        </ComponentPreview>

        <DocLead>With an error</DocLead>
        <ComponentPreview
          code={`<FormField label="Email" errorText="Enter a valid email address.">
  {(field) => <Input {...field} error defaultValue="not-an-email" />}
</FormField>`}
        >
          <FormField label="Email" errorText="Enter a valid email address." className="w-72">
            {(field) => <Input {...field} error defaultValue="not-an-email" />}
          </FormField>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Wires the label's <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">htmlFor</code> and the control's{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">id</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-describedby</code>{" "}
          together automatically, so a screen reader announces both the field's label and its
          helper/error text when the control receives focus. When <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">errorText</code> is
          set, the control also receives <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-invalid</code>,
          and the error text itself renders with <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">role=&quot;alert&quot;</code> (via HelperText)
          so it's announced when it appears. When <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">required</code> is
          set, the visual asterisk is <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-hidden</code> and
          purely decorative — the control instead receives real{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">required</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-required</code> attributes,
          so requiredness is announced regardless of whether a screen reader user can see the asterisk (WCAG AA a11y pass, 2026-08-06).
        </DocLead>
      </DocSection>
    </div>
  );
}
