import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function TooltipPage() {
  return (
    <div>
      <DocTitle>Tooltip</DocTitle>
      <DocLead>
        The lightest floating-content primitive — dark, small, hover/focus-triggered,
        supplementary only. Never the sole carrier of required information, since mobile/touch
        has no hover.
      </DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
