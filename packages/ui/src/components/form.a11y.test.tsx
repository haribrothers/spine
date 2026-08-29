import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Form, FormControl, FormMessage, FormSubmit, RadixFormField } from "./form";
import { Label } from "./label";
import { Button } from "./button";

describe("Form a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Form>
        <RadixFormField name="email" className="mb-3 flex flex-col gap-1.5">
          <Label htmlFor="contact-email">Contact email</Label>
          <FormControl asChild>
            <input id="contact-email" type="email" required />
          </FormControl>
          <FormMessage match="valueMissing">Email is required.</FormMessage>
          <FormMessage match="typeMismatch">Enter a valid email address.</FormMessage>
        </RadixFormField>
        <FormSubmit asChild>
          <Button>Submit</Button>
        </FormSubmit>
      </Form>,
    );
    await expectNoA11yViolations(container);
  });
});
