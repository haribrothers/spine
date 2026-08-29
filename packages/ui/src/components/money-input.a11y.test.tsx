import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { MoneyInput } from "./money-input";

describe("MoneyInput a11y", () => {
  it("has no violations with an associated label", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="invoice-amount">Amount</Label>
        <MoneyInput id="invoice-amount" value={124000n} onValueChange={() => {}} currency="USD" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations in an error state", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="invoice-amount-error">Amount</Label>
        <MoneyInput
          id="invoice-amount-error"
          value={0n}
          onValueChange={() => {}}
          currency="USD"
          error
          aria-describedby="invoice-amount-error-msg"
        />
        <p id="invoice-amount-error-msg">Amount must be greater than zero.</p>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
