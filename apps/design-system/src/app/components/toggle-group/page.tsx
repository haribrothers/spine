import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { LayoutGrid, List } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function ToggleGroupPage() {
  return (
    <div>
      <DocTitle>ToggleGroup</DocTitle>
      <DocLead>A set of two-state buttons that can be toggled on or off — a single-select icon row, e.g. a document view switcher.</DocLead>

      <ComponentPreview>
        <ToggleGroup type="single" defaultValue="list">
          <ToggleGroupItem value="list" aria-label="List view">
            <List size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid size={16} />
          </ToggleGroupItem>
        </ToggleGroup>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Supports single or multiple selection.", "Full keyboard navigation, roving tabindex."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ToggleGroup, ToggleGroupItem } from "@spine/ui";

export default () => (
  <ToggleGroup type="single">
    <ToggleGroupItem value="list" />
  </ToggleGroup>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "type", type: "single | multiple" },
            { prop: "value", type: "string | string[]" },
            { prop: "onValueChange", type: "(value: string | string[]) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<ToggleGroup type="single" defaultValue="list">
  <ToggleGroupItem value="list" aria-label="List view"><List size={16} /></ToggleGroupItem>
  <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid size={16} /></ToggleGroupItem>
</ToggleGroup>`}
        >
          <ToggleGroup type="single" defaultValue="list">
            <ToggleGroupItem value="list" aria-label="List view">
              <List size={16} />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid size={16} />
            </ToggleGroupItem>
          </ToggleGroup>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the first (or last-selected) item." },
            { keys: "ArrowRight", description: "Moves focus to the next item." },
            { keys: "ArrowLeft", description: "Moves focus to the previous item." },
            { keys: "Space", description: "Toggles the focused item." },
          ]}
        />
      </DocSection>
    </div>
  );
}
