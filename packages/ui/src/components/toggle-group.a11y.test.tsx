import { act, fireEvent, render, screen } from "@testing-library/react";
import { LayoutGrid, List } from "lucide-react";
import { describe, expect, it } from "vitest";
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

  it("has no violations with the tooltip open, and the tooltip names the icon-only option", async () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="grid" aria-label="View">
        <ToggleGroupItem value="list" aria-label="List view">
          <List size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid size={16} />
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    const list = screen.getByRole("radio", { name: "List view" });
    await act(async () => {
      fireEvent.focus(list);
    });
    expect((await screen.findAllByText("List view")).length).toBeGreaterThan(0);
    // The chosen option is announced as checked, not shown by colour alone.
    expect(screen.getByRole("radio", { name: "Grid view" }).getAttribute("aria-checked")).toBe("true");
    await expectNoA11yViolations(container);
  });

  it("has no violations with text options and no tooltip", async () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="accrual" aria-label="Profit basis">
        <ToggleGroupItem value="accrual">Accrual</ToggleGroupItem>
        <ToggleGroupItem value="cash">Cash</ToggleGroupItem>
      </ToggleGroup>,
    );
    await expectNoA11yViolations(container);
  });
});
