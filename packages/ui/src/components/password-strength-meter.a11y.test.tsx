import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { PasswordStrengthMeter } from "./password-strength-meter";

describe("PasswordStrengthMeter a11y", () => {
  it("announces the level politely and has no violations", async () => {
    const { container } = render(<PasswordStrengthMeter password="riverstone8" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Password strength: Fair");
    expect(status.getAttribute("aria-live")).toBe("polite");
    await expectNoA11yViolations(container);
  });

  it("says which checks are done, not by colour alone", () => {
    render(<PasswordStrengthMeter password="Deck&Pergola-2026" />);
    expect(screen.getAllByText("(done)", { exact: false })).toHaveLength(5);
  });
});
