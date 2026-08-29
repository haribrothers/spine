import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { PasswordToggleField, PasswordToggleFieldInput, PasswordToggleFieldToggle } from "./password-toggle-field";

describe("PasswordToggleField a11y", () => {
  it("has no violations with an associated label", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="password">Password</Label>
        <PasswordToggleField>
          <div className="relative w-64">
            <PasswordToggleFieldInput id="password" placeholder="Password" />
            <PasswordToggleFieldToggle />
          </div>
        </PasswordToggleField>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="password-disabled">Password</Label>
        <PasswordToggleField>
          <div className="relative w-64">
            <PasswordToggleFieldInput id="password-disabled" disabled />
            <PasswordToggleFieldToggle disabled />
          </div>
        </PasswordToggleField>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
