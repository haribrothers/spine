import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

describe("Collapsible a11y", () => {
  it("has no violations (closed)", async () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>Show variation orders</CollapsibleTrigger>
        <CollapsibleContent>VO-01: Additional footings — $1,200.00</CollapsibleContent>
      </Collapsible>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (open)", async () => {
    const { container } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Show variation orders</CollapsibleTrigger>
        <CollapsibleContent>VO-01: Additional footings — $1,200.00</CollapsibleContent>
      </Collapsible>,
    );
    await expectNoA11yViolations(container);
  });
});
