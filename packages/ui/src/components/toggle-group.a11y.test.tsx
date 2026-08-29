import { render } from "@testing-library/react";
import { LayoutGrid, List } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

describe("ToggleGroup a11y", () => {
  it("has no violations (single select)", async () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="list">
        <ToggleGroupItem value="list" aria-label="List view">
          <List size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid size={16} />
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (multiple select)", async () => {
    const { container } = render(
      <ToggleGroup type="multiple" defaultValue={["list"]}>
        <ToggleGroupItem value="list" aria-label="List view">
          <List size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid size={16} />
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    await expectNoA11yViolations(container);
  });
});
