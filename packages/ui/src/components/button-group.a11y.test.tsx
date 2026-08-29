import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { ButtonGroup } from "./button-group";

describe("ButtonGroup a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ButtonGroup>
        <Button variant="secondary">List</Button>
        <Button variant="secondary">Board</Button>
      </ButtonGroup>,
    );
    await expectNoA11yViolations(container);
  });
});
