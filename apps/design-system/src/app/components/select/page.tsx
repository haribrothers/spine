"use client";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocSubsection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function SelectPage() {
  return (
    <div>
      <DocTitle>Select</DocTitle>
      <DocLead>
        Displays a list of options for the user to pick from — triggered by a button. A flat,
        fixed list — e.g. a document status, a tax rate. Reach for Combobox instead when the
        list needs search-as-you-type filtering.
      </DocLead>

      <ComponentPreview>
        <Select defaultValue="draft">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={["Under 768px the options open in a bottom sheet (US-OPS-60).", 
            "Can be controlled or uncontrolled.",
            "Offers 2 positioning modes.",
            "Supports items, labels, groups of options.",
            "Focus is fully managed.",
            "Full keyboard navigation.",
            "Supports custom placeholder content.",
            "Typeahead support.",
            "Renders at the z-popover stacking tier, above Dialog/Drawer's z-modal tier — a Select opened from inside a Dialog or Drawer always renders on top of it, never hidden behind it. See the \"Inside a Dialog\" example below.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator } from "@spine/ui";

export default () => (
  <Select>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel />
        <SelectItem />
      </SelectGroup>
      <SelectSeparator />
    </SelectContent>
  </Select>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <DocSubsection id="select-root" title="Select">
          <ApiTable
            rows={[
              { prop: "value", type: "string" },
              { prop: "defaultValue", type: "string" },
              { prop: "onValueChange", type: "(value: string) => void" },
              { prop: "disabled", type: "boolean", defaultValue: "false" },
            ]}
          />
        </DocSubsection>
        <DocSubsection id="select-trigger" title="SelectTrigger">
          <DocLead>The button that toggles the select.</DocLead>
        </DocSubsection>
        <DocSubsection id="select-content" title="SelectContent">
          <ApiTable rows={[{ prop: "position", type: "item-aligned | popper", defaultValue: "popper" }]} />
        </DocSubsection>
        <DocSubsection id="select-item" title="SelectItem">
          <ApiTable rows={[{ prop: "value", type: "string" }, { prop: "disabled", type: "boolean", defaultValue: "false" }]} />
        </DocSubsection>
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Select defaultValue="draft">
  <SelectTrigger className="w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="draft">Draft</SelectItem>
    <SelectItem value="sent">Sent</SelectItem>
    <SelectItem value="paid">Paid</SelectItem>
    <SelectItem value="overdue">Overdue</SelectItem>
  </SelectContent>
</Select>`}
        >
          <Select defaultValue="draft">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </ComponentPreview>

        <DocLead>Grouped options</DocLead>
        <ComponentPreview
          code={`<Select defaultValue="usd">
  <SelectTrigger className="w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Common</SelectLabel>
      <SelectItem value="usd">USD</SelectItem>
      <SelectItem value="eur">EUR</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Other</SelectLabel>
      <SelectItem value="jpy">JPY</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`}
        >
          <Select defaultValue="usd">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Common</SelectLabel>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Other</SelectLabel>
                <SelectItem value="jpy">JPY</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </ComponentPreview>

        <DocLead>Inside a Dialog</DocLead>
        <ComponentPreview
          code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="secondary">Open dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Change status</DialogTitle>
    </DialogHeader>
    <DialogBody>
      <Select defaultValue="draft">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
        </SelectContent>
      </Select>
    </DialogBody>
  </DialogContent>
</Dialog>`}
        >
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change status</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Select defaultValue="draft">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/listbox/" className="text-primary underline underline-offset-2">
            ARIA Listbox
          </a>{" "}
          design pattern.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens the select and focuses the selected item." },
            { keys: "Enter", description: "Opens the select and focuses the first item." },
            { keys: "ArrowDown", description: "Moves focus to the next item." },
            { keys: "ArrowUp", description: "Moves focus to the previous item." },
            { keys: "Esc", description: "Closes the select without changing the value." },
            { keys: "A-Z", description: "Typeahead — jumps to an item matching the typed character(s)." },
          ]}
        />
      </DocSection>
    </div>
  );
}
