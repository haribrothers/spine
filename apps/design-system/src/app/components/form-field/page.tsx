import { FormField, Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function FormFieldPage() {
  return (
    <div>
      <DocTitle>FormField</DocTitle>
      <DocLead>
        Label above, control, helper/error text below — the composition every form control in
        the app should be built from, rather than hand-wiring Label/HelperText/aria attributes
        per screen.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<FormField label="Contact name" required>
  {(field) => <Input {...field} placeholder="Acme Contracting Ltd." />}
</FormField>`}
        >
          <FormField label="Contact name" required className="w-72">
            {(field) => <Input {...field} placeholder="Acme Contracting Ltd." />}
          </FormField>
        </ComponentPreview>
      </DocSection>

      <DocSection id="error" title="With an error">
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
    </div>
  );
}
