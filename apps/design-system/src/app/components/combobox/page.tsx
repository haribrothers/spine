"use client";

import { Combobox } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

const contacts = [
  { value: "acme", label: "Acme Contracting Ltd." },
  { value: "brightline", label: "Brightline Interiors" },
  { value: "coastal", label: "Coastal Fabrication Co." },
  { value: "delta", label: "Delta Electrical Services" },
];

function ComboboxDemo() {
  const [value, setValue] = useState<string>();
  return <Combobox options={contacts} value={value} onValueChange={setValue} placeholder="Select a contact…" />;
}

export default function ComboboxPage() {
  return (
    <div>
      <DocTitle>Combobox</DocTitle>
      <DocLead>
        The searchable counterpart to Select — reach for this when picking from a long list
        (a contact, a catalogue item) where typing to filter matters.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`const [value, setValue] = useState<string>();

<Combobox
  options={contacts}
  value={value}
  onValueChange={setValue}
  placeholder="Select a contact…"
/>`}
        >
          <ComboboxDemo />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
