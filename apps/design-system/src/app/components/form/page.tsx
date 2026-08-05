import { Button, Form, FormControl, FormMessage, FormSubmit, Label, RadixFormField } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function FormPage() {
  return (
    <div>
      <DocTitle>Form</DocTitle>
      <DocLead>
        Provides client-side validation for forms, leveraging native constraint validation.
        For real submitted forms with required/pattern/match rules — e.g. a matrix-entry or
        org-structure create form. Exported as{" "}
        <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">RadixFormField</code>{" "}
        (not <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">FormField</code>) to avoid
        colliding with the simpler, non-validation FormField composition — that one remains the
        right choice for a single already-validated field outside a submitted form.
      </DocLead>

      <ComponentPreview>
        <Form className="w-72">
          <RadixFormField name="email" className="mb-3 flex flex-col gap-1.5">
            <Label>Email</Label>
            <FormControl asChild>
              <input type="email" required />
            </FormControl>
            <FormMessage match="valueMissing">Email is required.</FormMessage>
            <FormMessage match="typeMismatch">Enter a valid email address.</FormMessage>
          </RadixFormField>
          <FormSubmit asChild>
            <Button>Submit</Button>
          </FormSubmit>
        </Form>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Auto-generates accessible error messages using native HTML validation attributes.",
            "Collects data as native FormData on submit.",
            "Extensible with custom validation logic via a Match prop.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Form, RadixFormField, FormLabel, FormControl, FormMessage, FormSubmit } from "@spine/ui";

export default () => (
  <Form>
    <RadixFormField name="email">
      <FormLabel />
      <FormControl />
      <FormMessage match="valueMissing" />
    </RadixFormField>
    <FormSubmit />
  </Form>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "RadixFormField.name", type: "string" },
            { prop: "FormMessage.match", type: "'valueMissing' | 'typeMismatch' | 'patternMismatch' | …" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Form>
  <RadixFormField name="email" className="mb-3 flex flex-col gap-1.5">
    <Label>Email</Label>
    <FormControl asChild>
      <input type="email" required />
    </FormControl>
    <FormMessage match="valueMissing">Email is required.</FormMessage>
    <FormMessage match="typeMismatch">Enter a valid email address.</FormMessage>
  </RadixFormField>
  <FormSubmit asChild>
    <Button>Submit</Button>
  </FormSubmit>
</Form>`}
        >
          <Form className="w-72">
            <RadixFormField name="email" className="mb-3 flex flex-col gap-1.5">
              <Label>Email</Label>
              <FormControl asChild>
                <input type="email" required />
              </FormControl>
              <FormMessage match="valueMissing">Email is required.</FormMessage>
              <FormMessage match="typeMismatch">Enter a valid email address.</FormMessage>
            </RadixFormField>
            <FormSubmit asChild>
              <Button>Submit</Button>
            </FormSubmit>
          </Form>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Field errors are announced via an ARIA live region as validity changes, without requiring a page reload or manual focus management.</DocLead>
        <KeyboardTable rows={[{ keys: "Enter", description: "Submits the form when focus is within a text field." }]} />
      </DocSection>
    </div>
  );
}
