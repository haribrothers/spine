import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ScrollArea className="h-40 w-64 rounded-md border border-border p-3">
        <div className="space-y-2 text-[13px] text-on-surface">
          {Array.from({ length: 20 }, (_, i) => (
            <p key={i}>Job #{i + 1} — Site inspection</p>
          ))}
        </div>
      </ScrollArea>,
    );
    await expectNoA11yViolations(container);
  });
});
