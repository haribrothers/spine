import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "./context-menu";

describe("ContextMenu a11y", () => {
  it("has no violations while open (via right-click)", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center border border-border text-[13px]">
          Right-click this job row
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Job actions</ContextMenuLabel>
          <ContextMenuItem>View job</ContextMenuItem>
          <ContextMenuItem>Add milestone</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive>Archive job</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    const user = userEvent.setup();
    await user.pointer({ keys: "[MouseRight]", target: document.querySelector("[data-radix-collection-item], [id]") ?? document.body });
    // Fire a real contextmenu event on the trigger, which is what Radix listens for.
    const trigger = document.querySelector('[data-state]') ?? document.body;
    trigger.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    await expectNoA11yViolations(document.body);
  });
});
