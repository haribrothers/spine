import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

describe("Accordion a11y", () => {
  it("has no violations (single, collapsible)", async () => {
    const { container } = render(
      <Accordion type="single" collapsible className="w-96">
        <AccordionItem value="tax-inclusive">
          <AccordionTrigger>What does tax-inclusive pricing mean?</AccordionTrigger>
          <AccordionContent>The displayed price already contains tax.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="retention">
          <AccordionTrigger>What is retention?</AccordionTrigger>
          <AccordionContent>A percentage withheld until the defect liability period ends.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with an item open", async () => {
    const { container } = render(
      <Accordion type="single" defaultValue="retention" className="w-96">
        <AccordionItem value="tax-inclusive">
          <AccordionTrigger>What does tax-inclusive pricing mean?</AccordionTrigger>
          <AccordionContent>The displayed price already contains tax.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="retention">
          <AccordionTrigger>What is retention?</AccordionTrigger>
          <AccordionContent>A percentage withheld until the defect liability period ends.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (multiple type)", async () => {
    const { container } = render(
      <Accordion type="multiple" defaultValue={["tax-inclusive", "retention"]} className="w-96">
        <AccordionItem value="tax-inclusive">
          <AccordionTrigger>What does tax-inclusive pricing mean?</AccordionTrigger>
          <AccordionContent>The displayed price already contains tax.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="retention">
          <AccordionTrigger>What is retention?</AccordionTrigger>
          <AccordionContent>A percentage withheld until the defect liability period ends.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    await expectNoA11yViolations(container);
  });
});
