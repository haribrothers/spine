import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { HelperText } from "./helper-text";
import { Label } from "./label";
import { Input } from "./input";

describe("HelperText a11y", () => {
  it("has no violations as helper text", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" aria-describedby="unit-helper" defaultValue="hrs" />
        <HelperText id="unit-helper">Used across the catalogue for time-based line items.</HelperText>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations as error text", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" aria-describedby="amount-helper" aria-invalid defaultValue="-10" />
        <HelperText id="amount-helper" error>
          Enter an amount greater than zero.
        </HelperText>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
