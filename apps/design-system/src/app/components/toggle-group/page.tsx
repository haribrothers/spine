import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { LayoutGrid, List, Monitor, Moon, Sun, Table2 } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function ToggleGroupPage() {
  return (
    <div>
      <DocTitle>ToggleGroup</DocTitle>
      <DocLead>
        A row of options with one (or several) chosen — a list&apos;s view switcher, Accrual / Cash, a chart&apos;s range. One
        segmented look everywhere (US-OPS-36, D-210): the options sit in a grey track and the chosen one is a raised chip with a
        primary outline and a semibold, primary label. Screens don&apos;t restyle it.
      </DocLead>

      <ComponentPreview>
        <ToggleGroup type="single" defaultValue="card" aria-label="View">
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table2 size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="card" aria-label="Card view">
            <LayoutGrid size={16} />
          </ToggleGroupItem>
        </ToggleGroup>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Supports single or multiple selection.",
            "Full keyboard navigation, roving tabindex.",
            "The chosen option's outline passes 3:1 and its label 4.5:1 against the track, in light and dark (token control-selected for the chip); it's also announced as checked, so colour is never the only cue.",
            "An icon-only option shows its aria-label as a tooltip on hover and keyboard focus (the @spine/ui Tooltip). Pass tooltip to change the text, or tooltip={false} to turn it off.",
            "Don't restyle the chosen state per screen; use size=\"sm\" inside a card header and className only for layout (e.g. flex-1 to fill a width).",
          ]}
        />
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
            { prop: "ToggleGroupItem size", type: "default | sm", defaultValue: "default" },
            { prop: "ToggleGroupItem tooltip", type: "string | false", description: "Defaults to the aria-label of an icon-only option." },
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
        <DocLead>With labels, small</DocLead>
        <ComponentPreview
          code={`<ToggleGroup type="single" defaultValue="12" aria-label="Range">
  <ToggleGroupItem value="3" size="sm">3M</ToggleGroupItem>
  <ToggleGroupItem value="6" size="sm">6M</ToggleGroupItem>
  <ToggleGroupItem value="12" size="sm">12M</ToggleGroupItem>
</ToggleGroup>`}
        >
          <ToggleGroup type="single" defaultValue="12" aria-label="Range">
            <ToggleGroupItem value="3" size="sm">
              3M
            </ToggleGroupItem>
            <ToggleGroupItem value="6" size="sm">
              6M
            </ToggleGroupItem>
            <ToggleGroupItem value="12" size="sm">
              12M
            </ToggleGroupItem>
          </ToggleGroup>
        </ComponentPreview>
        <DocLead>Icon and label</DocLead>
        <ComponentPreview>
          <ToggleGroup type="single" defaultValue="system" aria-label="Theme">
            <ToggleGroupItem value="light">
              <Sun size={14} /> Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark">
              <Moon size={14} /> Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system">
              <Monitor size={14} /> System
            </ToggleGroupItem>
          </ToggleGroup>
        </ComponentPreview>
        <DocLead>Disabled</DocLead>
        <ComponentPreview>
          <ToggleGroup type="single" defaultValue="grid" disabled aria-label="View">
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
