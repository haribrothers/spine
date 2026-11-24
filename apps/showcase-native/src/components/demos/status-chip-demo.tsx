import { View } from "react-native";
import { StatusChip } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function StatusChipDemo() {
  return (
    <>
      <DemoLead>
        The single, reserved component for paid/due-soon/overdue/draft — never repurposed as a generic badge (see
        Badge for that).
      </DemoLead>
      <DemoSection title="Statuses">
        <DemoPreview>
          <View className="flex-row flex-wrap gap-2">
            <StatusChip status="paid">Paid</StatusChip>
            <StatusChip status="due-soon">Due soon</StatusChip>
            <StatusChip status="overdue">Overdue</StatusChip>
            <StatusChip status="draft">Draft</StatusChip>
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
