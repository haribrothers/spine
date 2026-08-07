"use client";

import { Combobox } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

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

const units = [
  { value: "hour", label: "hour" },
  { value: "sq-ft", label: "sq ft" },
  { value: "each", label: "each" },
];

function ComboboxCreatableDemo() {
  const [value, setValue] = useState<string>("");
  return (
    <Combobox
      options={units}
      value={value}
      onValueChange={setValue}
      placeholder="Select or type a unit…"
      allowCreate
    />
  );
}

export default function ComboboxPage() {
  return (
    <div>
      <DocTitle>Combobox</DocTitle>
      <DocLead>
        The searchable counterpart to Select — reach for this when picking from a long list (a
        contact, a catalogue item) where typing to filter matters. Composed from Popover and{" "}
        <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">cmdk</code>{" "}
        rather than a dedicated Radix primitive, since Radix doesn't ship one.
      </DocLead>

      <ComponentPreview>
        <ComboboxDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Type-to-filter search over the option list.",
            "Keyboard navigable — arrow keys move the highlight, Enter selects.",
            "Hosted in a Popover, matching the field's trigger width.",
            "Shows a configurable empty state when no options match.",
            "Optional allowCreate mode: typing a value with no matching option offers a \"Create '…'\" row, for open-ended, org-defined vocabularies (e.g. a catalogue item's unit or category) rather than a fixed list.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Combobox } from "@spine/ui";

export default () => {
  const [value, setValue] = useState<string>();
  return (
    <Combobox
      options={[{ value: "acme", label: "Acme Contracting Ltd." }]}
      value={value}
      onValueChange={setValue}
    />
  );
};`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "options", type: "{ value: string; label: string }[]" },
            { prop: "value", type: "string" },
            { prop: "onValueChange", type: "(value: string) => void" },
            { prop: "placeholder", type: "string", defaultValue: '"Select…"' },
            { prop: "emptyText", type: "string", defaultValue: '"No results found."' },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
            { prop: "allowCreate", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
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

        <DocLead>Creatable (allowCreate)</DocLead>
        <ComponentPreview
          code={`const [value, setValue] = useState("");

<Combobox
  options={units}
  value={value}
  onValueChange={setValue}
  placeholder="Select or type a unit…"
  allowCreate
/>`}
        >
          <ComboboxCreatableDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens the combobox." },
            { keys: "ArrowDown", description: "Moves highlight to the next option." },
            { keys: "ArrowUp", description: "Moves highlight to the previous option." },
            { keys: "Enter", description: "Selects the highlighted option and closes." },
            { keys: "Esc", description: "Closes without changing the value." },
          ]}
        />
      </DocSection>
    </div>
  );
}
