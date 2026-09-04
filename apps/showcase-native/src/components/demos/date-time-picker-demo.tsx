import { useState } from "react";
import { Text } from "react-native";
import { DateTimePicker } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function DateTimePickerDemo() {
  const [date, setDate] = useState(new Date());

  return (
    <>
      <DemoLead>
        `@expo/ui`'s community DateTimePicker — `@react-native-community/datetimepicker`-compatible, real native
        date/time pickers on both platforms.
      </DemoLead>
      <DemoSection title="Date">
        <DemoPreview>
          <DateTimePicker value={date} onChange={setDate} mode="date" />
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{date.toDateString()}</Text>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
