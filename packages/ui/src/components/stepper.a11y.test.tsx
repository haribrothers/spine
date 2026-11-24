import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Stepper } from "./stepper";

const steps = [
  { key: "profile", label: "Business profile" },
  { key: "template", label: "Industry template" },
  { key: "tax", label: "Tax rates" },
  { key: "numbering", label: "Numbering" },
];

describe("Stepper a11y", () => {
  it("has no violations at the first step", async () => {
    const { container } = render(<Stepper steps={steps} currentIndex={0} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations mid-way with completed steps", async () => {
    const { container } = render(<Stepper steps={steps} currentIndex={2} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations at the last step", async () => {
    const { container } = render(<Stepper steps={steps} currentIndex={steps.length - 1} />);
    await expectNoA11yViolations(container);
  });
});
