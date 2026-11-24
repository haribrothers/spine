import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

describe("Checkbox a11y", () => {
  it("has no violations (unchecked)", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="billable" />
        <Label htmlFor="billable">Mark as billable to customer</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (checked)", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="billable-checked" defaultChecked />
        <Label htmlFor="billable-checked">Mark as billable to customer</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (indeterminate)", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="billable-indeterminate" checked="indeterminate" />
        <Label htmlFor="billable-indeterminate">Select all line items</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (disabled)", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="billable-disabled" disabled />
        <Label htmlFor="billable-disabled">Mark as billable to customer</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-61: is marked to keep its own size on a phone, with the tap area drawn around it", () => {
    const { getByRole } = render(<Checkbox aria-label="Select row" />);
    expect(getByRole("checkbox").hasAttribute("data-tap-area")).toBe(true);
  });
});
