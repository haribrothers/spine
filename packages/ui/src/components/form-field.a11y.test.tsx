import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { FormField } from "./form-field";
import { Input } from "./input";

describe("FormField a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <FormField label="Job name" helperText="Shown to the customer on the quote.">
        {(field) => <Input {...field} defaultValue="Kitchen remodel" />}
      </FormField>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when required", async () => {
    const { container } = render(
      <FormField label="Contact email" required>
        {(field) => <Input {...field} type="email" />}
      </FormField>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with an error", async () => {
    const { container } = render(
      <FormField label="Total amount" errorText="Enter an amount greater than zero.">
        {(field) => <Input {...field} defaultValue="-50" />}
      </FormField>,
    );
    await expectNoA11yViolations(container);
  });
});
