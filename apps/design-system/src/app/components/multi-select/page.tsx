"use client";

import { MultiSelect } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

const contacts = [
  { value: "acme", label: "Acme Contracting Ltd." },
  { value: "brightline", label: "Brightline Interiors" },
  { value: "coastal", label: "Coastal Fabrication Co." },
  { value: "delta", label: "Delta Electrical Services" },
  { value: "everline", label: "Everline Plumbing" },
];

function MultiSelectDemo({ className }: { className?: string }) {
  const [value, setValue] = useState<string[]>(["acme", "brightline"]);
  return (
    <MultiSelect
      options={contacts}
      value={value}
      onValueChange={setValue}
      placeholder="Select contacts…"
      aria-label="Contacts"
      className={className}
    />
  );
}

export default function MultiSelectPage() {
  return (
    <div>
      <DocTitle>MultiSelect</DocTitle>
      <DocLead>
        The multi-value counterpart to Select — reach for this when more than one option can be
        picked at once (e.g. contacts on a job, tags on a catalogue item). Radix's Select
        primitive has no multi-select mode, so this is composed from Popover and a checkable
        option list instead, matching Combobox's structure. The trigger shows as many selected
        labels as fit, collapsing the rest into a "+N" chip.
      </DocLead>

      <ComponentPreview>
        <MultiSelectDemo className="w-64" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Selecting an option toggles it — no need to hold a modifier key.",
            "The trigger measures its own width and shows as many selected labels as fit before collapsing the remainder into a \"+N\" chip, remeasured on resize.",
            "Each option shows a checkmark when selected, matching Select's affordance.",
            "Works as a controlled component — value is always an array, even when empty.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { MultiSelect } from "@spine/ui";

export default () => {
  const [value, setValue] = useState<string[]>([]);
  return (
    <MultiSelect
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
            { prop: "value", type: "string[]" },
            { prop: "onValueChange", type: "(value: string[]) => void" },
            { prop: "placeholder", type: "string", defaultValue: '"Select…"' },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
            { prop: "aria-label", type: "string", description: "Accessible name for the trigger — provide this or aria-labelledby." },
            { prop: "aria-labelledby", type: "string" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`const [value, setValue] = useState<string[]>(["acme", "brightline"]);

<MultiSelect
  options={contacts}
  value={value}
  onValueChange={setValue}
  placeholder="Select contacts…"
/>`}
        >
          <MultiSelectDemo className="w-64" />
        </ComponentPreview>

        <DocLead>Narrow trigger — labels collapse into a +N chip</DocLead>
        <ComponentPreview
          code={`<MultiSelect
  options={contacts}
  value={value}
  onValueChange={setValue}
  className="w-40"
/>`}
        >
          <MultiSelectDemo className="w-40" />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Follows the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/listbox/" className="text-primary underline underline-offset-2">
            ARIA Listbox
          </a>{" "}
          pattern with <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-multiselectable</code>{" "}
          set on the list, and <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-selected</code>{" "}
          on each option reflecting its checked state.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens the multi-select." },
            { keys: "Tab", description: "Moves focus to the next option or out of the list." },
            { keys: "Enter", description: "Toggles the focused option." },
            { keys: "Esc", description: "Closes the multi-select without changing the value." },
          ]}
        />
      </DocSection>
    </div>
  );
}
