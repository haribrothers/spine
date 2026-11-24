import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { FormField } from "./form-field";
import { PasswordInput } from "./password-input";

describe("PasswordInput a11y", () => {
  it("has no violations, with a labelled show/hide button", async () => {
    const { container } = render(<FormField label="Password">{(field) => <PasswordInput {...field} />}</FormField>);
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("says Caps Lock is on while typing with it, and points the field at it", async () => {
    const { container } = render(<FormField label="Password">{(field) => <PasswordInput {...field} />}</FormField>);
    const input = screen.getByLabelText("Password");
    fireEvent.keyDown(input, { key: "A", modifierCapsLock: true });
    const hint = screen.getByText("Caps Lock is on.");
    expect(input.getAttribute("aria-describedby")).toContain(hint.id);
    await expectNoA11yViolations(container);
    fireEvent.blur(input);
    expect(screen.queryByText("Caps Lock is on.")).toBeNull();
  });
});
