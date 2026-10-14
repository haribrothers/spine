import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { SpineLogo } from "./spine-logo";

describe("SpineLogo a11y", () => {
  it("is one image named Spine, with no violations", async () => {
    const { container } = render(<SpineLogo variant="horizontal" />);
    expect(screen.getByRole("img", { name: "Spine" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("is hidden from screen readers when decorative", async () => {
    const { container } = render(
      <p>
        <SpineLogo decorative size={20} /> Sent with Spine
      </p>,
    );
    expect(screen.queryByRole("img")).toBeNull();
    await expectNoA11yViolations(container);
  });
});
