import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
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
