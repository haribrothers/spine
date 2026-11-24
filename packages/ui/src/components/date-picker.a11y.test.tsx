import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DatePicker } from "./date-picker";

describe("DatePicker a11y", () => {
  it("has no violations closed", async () => {
    const { container } = render(<DatePicker onChange={() => {}} placeholder="Invoice due date" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations open", async () => {
    render(<DatePicker onChange={() => {}} placeholder="Invoice due date" />);
    const user = userEvent.setup();
    await user.click(document.querySelector('[aria-haspopup="dialog"]')!);
    await expectNoA11yViolations(document.body);
  });

  it("has no violations with a value selected", async () => {
    const { container } = render(<DatePicker value={new Date("2026-08-29")} onChange={() => {}} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(<DatePicker onChange={() => {}} disabled />);
    await expectNoA11yViolations(container);
  });
});
