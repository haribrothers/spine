import { render, screen } from "@testing-library/react";
import { Ban, Banknote, Eye } from "lucide-react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";

describe("DropdownMenu a11y", () => {
  it("has no violations while open", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Invoice actions</DropdownMenuLabel>
          <DropdownMenuItem>Send reminder</DropdownMenuItem>
          <DropdownMenuItem>Record payment</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive>Void invoice</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const user = userEvent.setup();
    await user.click(document.querySelector("button")!);
    await expectNoA11yViolations(document.body);
  });

  it("US-OPS-37 · has no violations with icons and a destructive item; icons are hidden from assistive tech", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Eye aria-hidden />
            View
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Banknote aria-hidden />
            Record payment
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive>
            <Ban aria-hidden />
            Void
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const user = userEvent.setup();
    await user.click(document.querySelector("button")!);
    await expectNoA11yViolations(document.body);
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["View", "Record payment", "Void"]);
    for (const item of items) {
      expect(item.className).toContain("gap-2.5");
      expect(item.className).toContain("[&>svg]:size-3.5");
      expect(item.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    }
    expect(items[0]!.className).toContain("[&>svg]:text-on-surface-muted");
    expect(items[2]!.className).toContain("[&>svg]:text-overdue");
  });

  it("has no violations with checkbox items", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Columns</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked>Contact</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>Status</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const user = userEvent.setup();
    await user.click(document.querySelector("button")!);
    await expectNoA11yViolations(document.body);
  });
});
