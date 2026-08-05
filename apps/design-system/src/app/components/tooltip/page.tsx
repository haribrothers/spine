import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function TooltipPage() {
  return (
    <div>
      <DocTitle>Tooltip</DocTitle>
      <DocLead>
        A popup that displays information related to an element when hovered or focused. The
        lightest floating-content primitive — dark, small, supplementary only. Never the sole
        carrier of required information, since mobile/touch has no hover.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Configurable side, alignment, offsets, collision handling.",
            "Optionally render a pointing arrow.",
            "Supports custom show/hide delay duration, shared across a TooltipProvider.",
            "Closes on trigger click, Escape key, or when the trigger is scrolled out of view.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@spine/ui";

export default () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger />
      <TooltipContent />
    </Tooltip>
  </TooltipProvider>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "delayDuration", type: "number", defaultValue: "700 (set to 200 in apps/design-system's shell)" },
            { prop: "open", type: "boolean" },
            { prop: "onOpenChange", type: "(open: boolean) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">?</Button>
  </TooltipTrigger>
  <TooltipContent>Retention is held until the defect liability period ends.</TooltipContent>
</Tooltip>`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                ?
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retention is held until the defect liability period ends.</TooltipContent>
          </Tooltip>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/" className="text-primary underline underline-offset-2">
            ARIA Tooltip
          </a>{" "}
          pattern. Never place required information only inside a Tooltip — touch devices have
          no hover state to reveal it.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Opens/closes the tooltip when the trigger receives/loses focus." },
            { keys: "Esc", description: "Closes the tooltip." },
          ]}
        />
      </DocSection>
    </div>
  );
}
