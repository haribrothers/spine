import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Field, FieldDescription, FieldGroup, FieldLegend, FieldSet } from "./field";
import { Label } from "./label";
import { Input } from "./input";

describe("Field a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Field>
        <Label htmlFor="job-name">Job name</Label>
        <Input id="job-name" defaultValue="Kitchen remodel" />
      </Field>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a FieldGroup of two fields", async () => {
    const { container } = render(
      <FieldGroup>
        <Field>
          <Label htmlFor="address-line1">Address line 1</Label>
          <Input id="address-line1" defaultValue="12 Harbor Rd" />
        </Field>
        <Field>
          <Label htmlFor="address-line2">Address line 2</Label>
          <Input id="address-line2" />
        </Field>
      </FieldGroup>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a FieldSet and legend", async () => {
    const { container } = render(
      <FieldSet>
        <FieldLegend>Billing address</FieldLegend>
        <FieldDescription>Used on invoices and quotes.</FieldDescription>
        <Field>
          <Label htmlFor="city">City</Label>
          <Input id="city" defaultValue="Portland" />
        </Field>
      </FieldSet>,
    );
    await expectNoA11yViolations(container);
  });
});
