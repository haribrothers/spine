import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { MiniCalendar } from "./calendar-mini";

describe("MiniCalendar a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<MiniCalendar onSelect={() => {}} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with a selected date", async () => {
    const { container } = render(<MiniCalendar selected={new Date()} onSelect={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
