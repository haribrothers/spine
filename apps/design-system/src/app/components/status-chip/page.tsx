import { StatusChip } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function StatusChipPage() {
  return (
    <div>
      <DocTitle>StatusChip</DocTitle>
      <DocLead>
        The single component for paid/due-soon/overdue/draft. This reserved palette is never
        repurposed for a generic badge or tag — see Badge for that. Always paired with a text
        label; color alone never carries the meaning.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "The status prop only accepts the four reserved values — the type system enforces the reserved-palette rule, not just documentation.",
            "Always renders as a pill shape, distinct from Badge's shape at a glance is intentional but not the sole signal — text is always present too.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { StatusChip } from "@spine/ui";

export default () => <StatusChip status="paid">Paid</StatusChip>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "status", type: "paid | due-soon | overdue | draft", defaultValue: "draft" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Statuses</DocLead>
        <ComponentPreview
          code={`<StatusChip status="paid">Paid</StatusChip>
<StatusChip status="due-soon">Due in 3 days</StatusChip>
<StatusChip status="overdue">Overdue</StatusChip>
<StatusChip status="draft">Draft</StatusChip>`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status="paid">Paid</StatusChip>
            <StatusChip status="due-soon">Due in 3 days</StatusChip>
            <StatusChip status="overdue">Overdue</StatusChip>
            <StatusChip status="draft">Draft</StatusChip>
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Color is never the sole carrier of meaning — the text label ("Paid", "Overdue") is
          always rendered alongside the color, so the status reads correctly for colorblind
          users and in grayscale print.
        </DocLead>
      </DocSection>
    </div>
  );
}
