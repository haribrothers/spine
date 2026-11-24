import { render } from "@testing-library/react";
import { Bold, Italic, Underline } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarToggleGroup, ToolbarToggleItem } from "./toolbar";

describe("Toolbar a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Toolbar aria-label="Quote terms formatting">
        <ToolbarToggleGroup type="single" defaultValue="bold">
          <ToolbarToggleItem value="bold" aria-label="Bold">
            <Bold size={14} />
          </ToolbarToggleItem>
          <ToolbarToggleItem value="italic" aria-label="Italic">
            <Italic size={14} />
          </ToolbarToggleItem>
          <ToolbarToggleItem value="underline" aria-label="Underline">
            <Underline size={14} />
          </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarSeparator />
        <ToolbarButton>Insert clause</ToolbarButton>
      </Toolbar>,
    );
    await expectNoA11yViolations(container);
  });
});
