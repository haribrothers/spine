import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { OTPField, OTPFieldHiddenInput, OTPFieldInput } from "./otp-field";

describe("OTPField a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <OTPField className="flex gap-2">
        <OTPFieldInput />
        <OTPFieldInput />
        <OTPFieldInput />
        <OTPFieldInput />
        <OTPFieldHiddenInput name="otp" />
      </OTPField>,
    );
    await expectNoA11yViolations(container);
  });
});
