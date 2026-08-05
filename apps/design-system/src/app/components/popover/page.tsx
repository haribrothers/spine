import { Button, Popover, PopoverContent, PopoverTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function PopoverPage() {
  return (
    <div>
      <DocTitle>Popover</DocTitle>
      <DocLead>
        The general floating-card-on-click primitive — powers DatePicker and Combobox. Hosts
        real interactive content, unlike Tooltip which is supplementary text only.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<Popover>
  <PopoverTrigger asChild>
    <Button variant="secondary">Open popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <p className="text-[13px] text-on-surface">Popover content goes here.</p>
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
    </div>
  );
}
