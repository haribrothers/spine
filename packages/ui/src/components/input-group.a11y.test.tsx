import { render } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";
import { Label } from "./label";

describe("InputGroup a11y", () => {
  it("has no violations with a leading icon and label", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-search">Search jobs</Label>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput id="job-search" placeholder="Search jobs…" />
        </InputGroup>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a trailing addon", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="quote-total">Quote total</Label>
        <InputGroup>
          <InputGroupInput id="quote-total" placeholder="0.00" />
          <InputGroupAddon>USD</InputGroupAddon>
        </InputGroup>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
