import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Ban, Banknote, Bell, Copy, Download, Eye, FileMinus, History, Mail, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@spine/ui";
import { MENU_ICONS } from "../lib/menu-icons";

describe("US-OPS-37 · see what each menu action does at a glance", () => {
  it("gives each action the icon D-222 names, the same everywhere", () => {
    expect(MENU_ICONS).toMatchObject({
      view: Eye,
      edit: Pencil,
      duplicate: Copy,
      delete: Trash2,
      email: Mail,
      remind: Bell,
      recordPayment: Banknote,
      refund: Banknote,
      issueCreditNote: FileMinus,
      moveOff: Undo2,
      void: Ban,
      cancel: Ban,
      download: Download,
      history: History,
    });
  });

  it("the menu sets the icon's size, colour and spacing; a destructive item is red, icon and label", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button>Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <MENU_ICONS.view aria-hidden />
            View
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive>
            <MENU_ICONS.void aria-hidden />
            Void
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const [view, voidItem] = screen.getAllByRole("menuitem");
    expect(view!.className).toMatch(/\bgap-2\.5\b/);
    expect(view!.className).toContain("min-h-8");
    expect(view!.className).toContain("[&>svg]:text-on-surface-muted");
    expect(voidItem!.className).toContain("text-overdue");
    expect(voidItem!.className).toContain("[&>svg]:text-overdue");
    // Read by its label alone.
    expect(view!.textContent).toBe("View");
    expect(view!.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
