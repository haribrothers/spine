import { useState } from "react";
import { Text, View } from "react-native";
import { DateTimePicker } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function DateTimePickerDemo() {
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());

  return (
    <>
      <DemoLead>
        `@expo/ui`'s community DateTimePicker — `@react-native-community/datetimepicker`-compatible, real native
        date/time pickers on both platforms.
      </DemoLead>
      <DemoSection title="Date">
        <DemoPreview>
          <View className="w-full">
            <DateTimePicker value={date} onChange={setDate} mode="date" />
          </View>
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{date.toDateString()}</Text>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Time">
        <DemoPreview>
          <View className="w-full">
            <DateTimePicker value={time} onChange={setTime} mode="time" />
          </View>
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{time.toLocaleTimeString()}</Text>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
