import { StatusChip } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { ApiTable, DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function StatusChipPage() {
  return (
    <div>
      <DocTitle>StatusChip</DocTitle>
      <DocLead>
        The single component for paid/due-soon/overdue/draft. This reserved palette is never
        repurposed for a generic badge or tag — see Badge for that. Always paired with a text
        label; color alone never carries the meaning.
      </DocLead>

      <DocSection id="statuses" title="Statuses">
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

      <DocSection id="api" title="API">
        <ApiTable
          rows={[{ prop: "status", type: "paid | due-soon | overdue | draft", defaultValue: "draft" }]}
        />
      </DocSection>
    </div>
  );
}
