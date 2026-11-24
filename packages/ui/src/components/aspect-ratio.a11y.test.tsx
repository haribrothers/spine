import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { AspectRatio } from "./aspect-ratio";

describe("AspectRatio a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <div className="w-64">
        <AspectRatio ratio={16 / 9}>
          <img src="https://example.com/site-photo.jpg" alt="Foundation pour at the Riverside Extension job site" className="h-full w-full object-cover" />
        </AspectRatio>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
