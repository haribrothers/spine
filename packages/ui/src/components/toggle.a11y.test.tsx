import { render } from "@testing-library/react";
import { Bold } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Toggle } from "./toggle";

describe("Toggle a11y", () => {
  it("has no violations off", async () => {
    const { container } = render(
      <Toggle aria-label="Bold">
        <Bold size={16} />
      </Toggle>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations pressed", async () => {
    const { container } = render(
      <Toggle aria-label="Bold" pressed onPressedChange={() => {}}>
        <Bold size={16} />
      </Toggle>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations disabled", async () => {
    const { container } = render(
      <Toggle aria-label="Bold" disabled>
        <Bold size={16} />
      </Toggle>,
    );
    await expectNoA11yViolations(container);
  });
});
