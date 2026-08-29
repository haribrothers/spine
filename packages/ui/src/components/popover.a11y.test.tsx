import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover a11y", () => {
  it("has no violations while open", async () => {
    render(
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="secondary">Job actions</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="w-48 text-[13px] text-on-surface">Reassign this job to a different crew.</p>
        </PopoverContent>
      </Popover>,
    );
    // Radix portals PopoverContent onto document.body, outside the render container.
    await expectNoA11yViolations(document.body);
  });
});
