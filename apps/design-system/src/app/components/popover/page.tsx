import { Button, Popover, PopoverContent, PopoverTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocSubsection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function PopoverPage() {
  return (
    <div>
      <DocTitle>Popover</DocTitle>
      <DocLead>
        Displays rich content in a portal, triggered by a button. The general
        floating-card-on-click primitive — powers DatePicker and Combobox. Hosts real
        interactive content, unlike Tooltip which is supplementary text only.
      </DocLead>

      <ComponentPreview>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="w-48 text-[13px] text-on-surface">Popover content goes here.</p>
          </PopoverContent>
        </Popover>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Can be controlled or uncontrolled.",
            "Customize side, alignment, offsets, collision handling.",
            "Optionally render a pointing arrow.",
            "Focus is fully managed and customizable.",
            "Dismissing and layering behavior is highly customizable.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@spine/ui";

export default () => (
  <Popover>
    <PopoverTrigger />
    <PopoverAnchor />
    <PopoverContent />
  </Popover>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <DocSubsection id="popover-root" title="Popover">
          <ApiTable rows={[{ prop: "open", type: "boolean" }, { prop: "onOpenChange", type: "(open: boolean) => void" }, { prop: "modal", type: "boolean", defaultValue: "false" }]} />
        </DocSubsection>
        <DocSubsection id="popover-content" title="PopoverContent">
          <ApiTable
            rows={[
              { prop: "align", type: "start | center | end", defaultValue: "center" },
              { prop: "sideOffset", type: "number", defaultValue: "4" },
              { prop: "onOpenAutoFocus", type: "(event: Event) => void" },
              { prop: "onEscapeKeyDown", type: "(event: KeyboardEvent) => void" },
            ]}
          />
        </DocSubsection>
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Popover>
  <PopoverTrigger asChild>
    <Button variant="secondary">Open popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <p>Popover content goes here.</p>
  </PopoverContent>
</Popover>`}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="w-48 text-[13px] text-on-surface">Popover content goes here.</p>
            </PopoverContent>
          </Popover>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/" className="text-primary underline underline-offset-2">
            WAI-ARIA Dialog
          </a>{" "}
          pattern when modal, or behaves as a non-modal floating panel otherwise.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Opens/closes the popover." },
            { keys: "Enter", description: "Opens/closes the popover." },
            { keys: "Tab", description: "Moves focus to the next focusable element within the content." },
            { keys: "Esc", description: "Closes the popover and moves focus to the trigger." },
          ]}
        />
      </DocSection>
    </div>
  );
}
