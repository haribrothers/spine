import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Input } from "./input";
import { Label } from "./label";

describe("Label a11y", () => {
  it("has no violations paired with an input via htmlFor", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="contact-name">Contact name</Label>
        <Input id="contact-name" placeholder="Acme Contracting Ltd." />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
