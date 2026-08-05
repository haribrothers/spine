import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function CommandPage() {
  return (
    <div>
      <DocTitle>Command</DocTitle>
      <DocLead>
        A searchable command list. Standalone primitive — Combobox composes it with a Popover,
        and the design system's own ⌘K search palette composes it with a Dialog via
        CommandDialog.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Fuzzy, type-to-filter search across items and groups.", "Full keyboard navigation.", "Composable into a Combobox trigger or a full-screen CommandDialog."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@spine/ui";

export default () => (
  <Command>
    <CommandInput />
    <CommandList>
      <CommandEmpty />
      <CommandGroup>
        <CommandItem />
      </CommandGroup>
      <CommandSeparator />
    </CommandList>
  </Command>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "CommandItem.value", type: "string" }, { prop: "CommandItem.onSelect", type: "(value: string) => void" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Command className="w-72 rounded-md border border-border">
  <CommandInput placeholder="Search…" />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup>
      <CommandItem>New quote</CommandItem>
      <CommandItem>New invoice</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup>
      <CommandItem>Settings</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`}
        >
          <Command className="w-72 rounded-md border border-border">
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                <CommandItem>New quote</CommandItem>
                <CommandItem>New invoice</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem>Settings</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "ArrowDown", description: "Moves the highlight to the next item." },
            { keys: "ArrowUp", description: "Moves the highlight to the previous item." },
            { keys: "Enter", description: "Selects the highlighted item." },
          ]}
        />
      </DocSection>
    </div>
  );
}
