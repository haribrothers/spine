"use client";

import { DatePicker } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

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

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`const [date, setDate] = useState<Date>();

<DatePicker value={date} onChange={setDate} placeholder="Invoice due date" />`}
        >
          <DatePickerDemo />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
