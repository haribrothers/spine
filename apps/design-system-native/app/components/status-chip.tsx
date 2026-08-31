import { View } from "react-native";
import { StatusChip } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function StatusChipScreen() {
  return (
    <DocScreen>
      <DocTitle>StatusChip</DocTitle>
      <DocLead>
        The single component for paid/due-soon/overdue/draft. This reserved palette is never repurposed for a
        generic badge or tag — see Badge for that. Always paired with a text label; color alone never carries the
        meaning.
      </DocLead>

      <ComponentPreview>
        <View className="flex-row flex-wrap items-center gap-3">
          <StatusChip status="paid">Paid</StatusChip>
          <StatusChip status="due-soon">Due in 3 days</StatusChip>
          <StatusChip status="overdue">Overdue</StatusChip>
          <StatusChip status="draft">Draft</StatusChip>
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "The status prop only accepts the four reserved values — the type system enforces the reserved-palette rule, not just documentation.",
            "Always renders as a pill shape, distinct from Badge's shape at a glance is intentional but not the sole signal — text is always present too.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { StatusChip } from "@spine/ui-native";

<StatusChip status="paid">Paid</StatusChip>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable rows={[{ prop: "status", type: "paid | due-soon | overdue | draft", defaultValue: "draft" }]} />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Statuses</DocLead>
        <ComponentPreview
          code={`<StatusChip status="paid">Paid</StatusChip>
<StatusChip status="due-soon">Due in 3 days</StatusChip>
<StatusChip status="overdue">Overdue</StatusChip>
<StatusChip status="draft">Draft</StatusChip>`}
        >
          <View className="flex-row flex-wrap items-center gap-3">
            <StatusChip status="paid">Paid</StatusChip>
            <StatusChip status="due-soon">Due in 3 days</StatusChip>
            <StatusChip status="overdue">Overdue</StatusChip>
            <StatusChip status="draft">Draft</StatusChip>
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Color is never the sole carrier of meaning — the text label (&quot;Paid&quot;, &quot;Overdue&quot;) is
          always rendered alongside the color, so the status reads correctly for colorblind users.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
