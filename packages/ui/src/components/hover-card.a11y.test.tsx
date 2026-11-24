import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

describe("HoverCard a11y", () => {
  it("has no violations while open", async () => {
    render(
      <HoverCard open>
        <HoverCardTrigger className="text-[13px] text-primary underline underline-offset-2">Acme Contracting Ltd.</HoverCardTrigger>
        <HoverCardContent>
          <div className="text-[13px]">
            <p className="font-medium text-on-surface">Acme Contracting Ltd.</p>
            <p className="text-on-surface-muted">3 open invoices · $4,120 outstanding</p>
          </div>
        </HoverCardContent>
      </HoverCard>,
    );
    await expectNoA11yViolations(document.body);
  });
});
