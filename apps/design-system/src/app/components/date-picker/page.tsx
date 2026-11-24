"use client";

import { DatePicker } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

function DatePickerDemo() {
  const [date, setDate] = useState<Date>();
  return <DatePicker value={date} onChange={setDate} placeholder="Invoice due date" />;
}

export default function DatePickerPage() {
  return (
    <div>
      <DocTitle>DatePicker</DocTitle>
      <DocLead>
        Opens a Popover-hosted calendar rather than relying on native{" "}
        <code className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
          {"<input type=date>"}
        </code>{" "}
        chrome, which is inconsistent across browsers and OSes.
      </DocLead>

      <ComponentPreview>
        <DatePickerDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={["Under 768px the calendar opens in a bottom sheet (US-OPS-60).", 
            "A month-grid Calendar with prev/next navigation, no external date library dependency.",
            "Hosted in a Popover, closes automatically on selection.",
            "Field trigger shares Input/Select's chrome and height for a consistent form row.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { DatePicker } from "@spine/ui";

export default () => {
  const [date, setDate] = useState<Date>();
  return <DatePicker value={date} onChange={setDate} />;
};`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "Date" },
            { prop: "onChange", type: "(date: Date) => void" },
            { prop: "placeholder", type: "string", defaultValue: '"Pick a date"' },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`const [date, setDate] = useState<Date>();

<DatePicker value={date} onChange={setDate} placeholder="Invoice due date" />`}
        >
          <DatePickerDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens the calendar popover." },
            { keys: "Esc", description: "Closes the calendar without changing the value." },
            { keys: "Tab", description: "Moves focus between the prev-month button, next-month button, and day grid." },
          ]}
        />
      </DocSection>
    </div>
  );
}
