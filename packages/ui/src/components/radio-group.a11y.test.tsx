import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroup a11y", () => {
  it("has no violations with labeled items", async () => {
    const { container } = render(
      <RadioGroup defaultValue="exclusive" aria-label="Pricing basis">
        <label className="flex items-center gap-2">
          <RadioGroupItem value="exclusive" id="tax-exclusive" />
          <span className="text-[14px] text-on-surface">Tax-exclusive</span>
        </label>
        <label className="flex items-center gap-2">
          <RadioGroupItem value="inclusive" id="tax-inclusive" />
          <span className="text-[14px] text-on-surface">Tax-inclusive</span>
        </label>
      </RadioGroup>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a disabled item", async () => {
    const { container } = render(
      <RadioGroup defaultValue="exclusive" aria-label="Pricing basis">
        <label className="flex items-center gap-2">
          <RadioGroupItem value="exclusive" />
          <span className="text-[14px] text-on-surface">Tax-exclusive</span>
        </label>
        <label className="flex items-center gap-2 opacity-50">
          <RadioGroupItem value="inclusive" disabled />
          <span className="text-[14px] text-on-surface">Tax-inclusive</span>
        </label>
      </RadioGroup>,
    );
    await expectNoA11yViolations(container);
  });
});
