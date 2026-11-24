import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Input } from "./input";
import { Label } from "./label";

describe("Input a11y", () => {
  it("has no violations with an associated label", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-name">Job name</Label>
        <Input id="job-name" placeholder="Warehouse fit-out" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-name-disabled">Job name</Label>
        <Input id="job-name-disabled" disabled value="Warehouse fit-out" readOnly />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations in an error state", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-name-error">Job name</Label>
        <Input id="job-name-error" error aria-describedby="job-name-error-msg" />
        <p id="job-name-error-msg">Job name is required.</p>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
