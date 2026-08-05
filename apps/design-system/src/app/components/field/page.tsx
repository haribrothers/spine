import { FieldDescription, FieldGroup, FieldLegend, FieldSet, FormField, Input } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function FieldPage() {
  return (
    <div>
      <DocTitle>Field</DocTitle>
      <DocLead>
        A richer layout primitive for grouping multiple FormFields — e.g. a two-column address
        block, or a fieldset with a legend. Distinct from FormField, which wires up a single
        label/control/helper-text triplet; Field/FieldGroup/FieldSet only handle layout.
      </DocLead>

      <ComponentPreview>
        <FieldSet className="w-96">
          <FieldLegend>Site address</FieldLegend>
          <FieldGroup>
            <FormField label="Street">{(f) => <Input {...f} />}</FormField>
            <FormField label="City">{(f) => <Input {...f} />}</FormField>
          </FieldGroup>
          <FieldDescription>Used on the invoice PDF and the job&apos;s public quote link.</FieldDescription>
        </FieldSet>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["FieldGroup lays out its children in a responsive 2-column grid.", "FieldSet renders a real <fieldset>/<legend> pair for grouped, semantically related fields."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { FieldSet, FieldLegend, FieldGroup, Field, FieldDescription } from "@spine/ui";

export default () => (
  <FieldSet>
    <FieldLegend />
    <FieldGroup>
      <Field />
    </FieldGroup>
    <FieldDescription />
  </FieldSet>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div>/<fieldset>/<legend>/<p> attributes on the respective sub-parts" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<FieldSet className="w-96">
  <FieldLegend>Site address</FieldLegend>
  <FieldGroup>
    <FormField label="Street">{(f) => <Input {...f} />}</FormField>
    <FormField label="City">{(f) => <Input {...f} />}</FormField>
  </FieldGroup>
  <FieldDescription>Used on the invoice PDF and the job's public quote link.</FieldDescription>
</FieldSet>`}
        >
          <FieldSet className="w-96">
            <FieldLegend>Site address</FieldLegend>
            <FieldGroup>
              <FormField label="Street">{(f) => <Input {...f} />}</FormField>
              <FormField label="City">{(f) => <Input {...f} />}</FormField>
            </FieldGroup>
            <FieldDescription>Used on the invoice PDF and the job&apos;s public quote link.</FieldDescription>
          </FieldSet>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          FieldSet's real{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<fieldset>"}</code>/
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<legend>"}</code>{" "}
          pairing announces the group's purpose to screen readers before each field within it.
        </DocLead>
      </DocSection>
    </div>
  );
}
