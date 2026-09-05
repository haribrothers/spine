import { useState } from "react";
import { Text, View } from "react-native";
import { DateTimePicker } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

function DateRowDemo() {
  const [date, setDate] = useState(new Date());
  return (
    <View className="w-full flex-row items-center justify-between">
      <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">Start date</Text>
      <DateTimePicker value={date} onChange={setDate} mode="date" />
    </View>
  );
}

function TimeRowDemo() {
  const [time, setTime] = useState(new Date());
  return (
    <View className="w-full flex-row items-center justify-between">
      <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">Reminder time</Text>
      <DateTimePicker value={time} onChange={setTime} mode="time" />
    </View>
  );
}

export function DateTimePickerScreen() {
  return (
    <DocScreen>
      <DocTitle>Date &amp; Time Picker</DocTitle>
      <DocLead>
        A compact, inline date/time control — same `Switch`-style row shape (label on the left, control on the right)
        as any other form row, rather than a full-width block field.
      </DocLead>

      <ComponentPreview>
        <DateRowDemo />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Sizes to its own compact content, not a full-width block — designed to sit in a Switch-style row next to a label.",
            "Tapping the control opens a real native picker on both platforms.",
            'mode="date" | "time" | "datetime", plus minimumDate/maximumDate constraints.',
          ]}
        />
      </DocSection>

      <DocSection title="Platform mechanism (why the two branches differ under the hood)">
        <DocLead>
          Both platforms present as a small, tappable inline control, but the two use a different real mechanism
          under the hood, by deliberate choice. iOS renders `@expo/ui`&apos;s `DateTimePicker` with
          `display=&quot;compact&quot;` directly — a real, fully native SwiftUI pill that pops its own built-in
          calendar/wheel overlay on tap, no custom sheet or trigger of ours involved — given an explicit bounded
          `style` width (140pt for date/datetime, 90pt for time), since `Host`&apos;s own `matchContents` only
          constrains height, never width, and an unbounded width overflowed past the row&apos;s edge. Android has no
          equivalent built-in compact style, so a small tappable trigger here (formatted value plus a calendar/clock
          icon) mounts `@expo/ui`&apos;s native Material dialog (`presentation=&quot;dialog&quot;`) only while open,
          unmounting it via `onDismiss` (fires for both Cancel and a confirmed selection). See the component&apos;s
          own doc comment for the full design history — an earlier design used a shared `TextField`-styled trigger
          opening a `BottomSheet` on iOS, which regressed and was reverted; do not reintroduce it.
        </DocLead>
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { DateTimePicker } from "@spine/ui-native";
import { Text, View } from "react-native";

const [date, setDate] = useState(new Date());

<View className="flex-row items-center justify-between">
  <Text>Start date</Text>
  <DateTimePicker value={date} onChange={setDate} mode="date" />
</View>;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "Date" },
            { prop: "onChange", type: "(date: Date) => void" },
            { prop: "mode", type: '"date" | "time" | "datetime"', defaultValue: '"date"' },
            { prop: "minimumDate", type: "Date" },
            { prop: "maximumDate", type: "Date" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Date row</DocLead>
        <ComponentPreview
          code={`<View className="flex-row items-center justify-between">
  <Text>Start date</Text>
  <DateTimePicker value={date} onChange={setDate} mode="date" />
</View>`}
        >
          <DateRowDemo />
        </ComponentPreview>

        <DocLead>Time row</DocLead>
        <ComponentPreview
          code={`<View className="flex-row items-center justify-between">
  <Text>Reminder time</Text>
  <DateTimePicker value={time} onChange={setTime} mode="time" />
</View>`}
        >
          <TimeRowDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          The control itself is a real native picker on both platforms (SwiftUI&apos;s compact `DatePicker` on iOS, a
          Pressable trigger opening Android&apos;s Material dialog), so VoiceOver/TalkBack announce it the same way
          they do for any native date/time control — verified on-device, not via an automated test.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
