import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Separator } from "./separator";

describe("Separator a11y", () => {
  it("has no violations (horizontal)", async () => {
    const { container } = render(
      <div className="w-64">
        <Separator />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (vertical)", async () => {
    const { container } = render(
      <div className="flex h-6 items-center gap-3 text-[13px] text-on-surface">
        <span>Draft</span>
        <Separator orientation="vertical" />
        <span>Sent</span>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
