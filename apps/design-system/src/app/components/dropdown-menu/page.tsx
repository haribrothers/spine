import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function DropdownMenuPage() {
  return (
    <div>
      <DocTitle>DropdownMenu</DocTitle>
      <DocLead>
        Displays a menu to the user — such as a set of actions or functions — triggered by a
        button. A click-triggered floating action list — a table row's overflow menu.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Can be controlled or uncontrolled.",
            "Supports submenus with configurable reading direction.",
            "Supports items, labels, groups, checkable items (single or multiple) and a separator.",
            "Focus is fully managed and customizable.",
            "Full keyboard navigation with typeahead.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@spine/ui";

export default () => (
  <DropdownMenu>
    <DropdownMenuTrigger />
    <DropdownMenuContent>
      <DropdownMenuLabel />
      <DropdownMenuItem />
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem />
      <DropdownMenuRadioGroup>
        <DropdownMenuRadioItem />
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "DropdownMenuItem.destructive", type: "boolean", defaultValue: "false" },
            { prop: "DropdownMenuItem.disabled", type: "boolean", defaultValue: "false" },
            { prop: "DropdownMenuContent.align", type: "start | center | end", defaultValue: "start" },
            { prop: "DropdownMenuContent.sideOffset", type: "number", defaultValue: "4" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="secondary">Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuItem>Issue credit note</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem destructive>Void invoice</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Issue credit note</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>Void invoice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentPreview>

        <DocLead>Checkbox and radio items</DocLead>
        <ComponentPreview
          code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="secondary">View options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Columns</DropdownMenuLabel>
    <DropdownMenuCheckboxItem checked>Contact</DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked>Total</DropdownMenuCheckboxItem>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup value="date">
      <DropdownMenuRadioItem value="date">Sort by date</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="total">Sort by total</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">View options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked>Contact</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked>Total</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value="date">
                <DropdownMenuRadioItem value="date">Sort by date</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="total">Sort by total</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/" className="text-primary underline underline-offset-2">
            ARIA Menu Button
          </a>{" "}
          pattern.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens the menu; activates the focused item." },
            { keys: "Enter", description: "Opens the menu; activates the focused item." },
            { keys: "ArrowDown", description: "Moves focus to the next item." },
            { keys: "ArrowUp", description: "Moves focus to the previous item." },
            { keys: "ArrowRight", description: "Opens a submenu." },
            { keys: "ArrowLeft", description: "Closes a submenu." },
            { keys: "Esc", description: "Closes the menu and returns focus to the trigger." },
          ]}
        />
      </DocSection>
    </div>
  );
}
