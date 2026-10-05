import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";
import { CommandPaletteDemo } from "./demo";

export default function CommandPalettePage() {
  return (
    <div>
      <DocTitle>CommandPalette</DocTitle>
      <DocLead>
        The ⌘K search palette (US-OPS-22/23): a dialog with a search field and grouped results — a title, a second line and a status on the right —
        opened from anywhere. The caller runs the search and passes the groups; the palette never filters on its own.
      </DocLead>

      <ComponentPreview>
        <CommandPaletteDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A modal dialog named by `label`; the field is a combobox controlling a listbox of options.",
            "Arrow keys move the highlight (announced through aria-activedescendant), Enter picks, Escape closes and returns focus.",
            "Group headings, a second line and a status per result; an empty message or hint when there's nothing to show.",
            "Scales in only when the person allows motion (motion-safe).",
            "The first result is highlighted as soon as results arrive, and the palette keeps aria-activedescendant in step itself (cmdk works it out only once).",
            "Focus goes back to the element that had it before opening — also when opened by a shortcut with no trigger.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { CommandPalette } from "@spine/ui";

<CommandPalette
  open={open}
  onOpenChange={setOpen}
  label="Search"
  query={query}
  onQueryChange={setQuery}
  groups={[{ heading: "Invoices", items: [{ id: "i10", title: "INV-0010", subtitle: "Harborview · $9,700.00 due", meta: "Overdue" }] }]}
  onSelect={(item) => router.push(hrefFor(item.id))}
  emptyMessage={\`No results for “\${query}”\`}
  footer={<><span>↑↓ to move</span><span>Enter to open</span></>}
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "open / onOpenChange", type: "boolean / (open: boolean) => void" },
            { prop: "label", type: "string" },
            { prop: "query / onQueryChange", type: "string / (query: string) => void" },
            { prop: "groups", type: "{ heading: string; items: { id, title, subtitle?, meta? }[] }[]" },
            { prop: "onSelect", type: "(item) => void" },
            { prop: "loading", type: "boolean" },
            { prop: "emptyMessage / hint", type: "ReactNode" },
            { prop: "footer", type: "ReactNode" },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "⌘K / Ctrl+K", description: "Opens the palette (wired by the app) with focus in the field." },
            { keys: "ArrowDown / ArrowUp", description: "Moves the highlight; the active option is announced." },
            { keys: "Enter", description: "Opens the highlighted result." },
            { keys: "Escape", description: "Closes the palette and returns focus to where it was." },
          ]}
        />
      </DocSection>
    </div>
  );
}
