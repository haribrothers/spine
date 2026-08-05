import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function AccordionPage() {
  return (
    <div>
      <DocTitle>Accordion</DocTitle>
      <DocLead>
        A vertically stacked set of interactive headings that each reveal an associated
        section of content — built from Collapsible. Single-open or multi-open.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Full keyboard navigation.",
            "Can expand one or multiple items.",
            "Can be controlled or uncontrolled.",
            "Supports RTL direction.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@spine/ui";

export default () => (
  <Accordion type="single" collapsible>
    <AccordionItem value="item-1">
      <AccordionTrigger />
      <AccordionContent />
    </AccordionItem>
  </Accordion>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "type", type: "single | multiple" },
            { prop: "collapsible", type: "boolean", defaultValue: "false (single type only)" },
            { prop: "value", type: "string | string[]" },
            { prop: "onValueChange", type: "(value: string | string[]) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Accordion type="single" collapsible className="w-96">
  <AccordionItem value="tax-inclusive">
    <AccordionTrigger>What does tax-inclusive pricing mean?</AccordionTrigger>
    <AccordionContent>The displayed price already contains tax.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="retention">
    <AccordionTrigger>What is retention?</AccordionTrigger>
    <AccordionContent>A percentage withheld until the defect liability period ends.</AccordionContent>
  </AccordionItem>
</Accordion>`}
        >
          <Accordion type="single" collapsible className="w-96">
            <AccordionItem value="tax-inclusive">
              <AccordionTrigger>What does tax-inclusive pricing mean?</AccordionTrigger>
              <AccordionContent>The displayed price already contains tax.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="retention">
              <AccordionTrigger>What is retention?</AccordionTrigger>
              <AccordionContent>A percentage withheld until the defect liability period ends.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/accordion/" className="text-primary underline underline-offset-2">
            ARIA Accordion
          </a>{" "}
          pattern.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Space", description: "Toggles the focused item." },
            { keys: "Enter", description: "Toggles the focused item." },
            { keys: "ArrowDown", description: "Moves focus to the next trigger." },
            { keys: "ArrowUp", description: "Moves focus to the previous trigger." },
            { keys: "Home", description: "Moves focus to the first trigger." },
            { keys: "End", description: "Moves focus to the last trigger." },
          ]}
        />
      </DocSection>
    </div>
  );
}
