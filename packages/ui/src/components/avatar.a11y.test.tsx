import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Avatar, AvatarFallback } from "./avatar";

describe("Avatar a11y", () => {
  it.each(["sm", "md", "lg"] as const)("has no violations (%s)", async (size) => {
    const { container } = render(
      <Avatar size={size}>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    await expectNoA11yViolations(container);
  });
});
