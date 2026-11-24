import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("Tooltip a11y", () => {
  it("has no violations while open", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Retention info">
              ?
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retention is held until the defect liability period ends.</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    // Radix portals TooltipContent onto document.body.
    await expectNoA11yViolations(document.body);
  });
});
