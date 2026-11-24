import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogTitle } from "./alert-dialog";
import { Button } from "./button";
import { CommandPalette } from "./command-palette";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** Makes `usePhone` (and any matchMedia check) answer as a 390px-wide phone. */
function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("US-OPS-60 · use dialogs, menus and pickers made for my phone", () => {
  it("a dialog is marked as a full-screen sheet; its footer becomes the bar at the top and the ✕ steps aside", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <DialogBody>Amount</DialogBody>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Record a payment" });
    expect(dialog.hasAttribute("data-dialog")).toBe(true);
    expect(dialog.hasAttribute("data-phone-fullscreen")).toBe(true);
    expect(dialog.className).toContain("max-md:h-dvh");
    const footer = dialog.querySelector("[data-dialog-footer]")!;
    expect(footer.className).toContain("max-md:order-first");
    expect(footer.className).toContain("max-md:justify-between");
    expect(dialog.querySelector("[data-dialog-close]")).not.toBeNull();
    await expectNoA11yViolations(document.body);
  });

  it("a menu is an action sheet; on a phone it's headed by what it acts on and ends with Cancel", async () => {
    asPhone(true);
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sheetTitle="INV-0044">
          <DropdownMenuItem>Record payment</DropdownMenuItem>
          <DropdownMenuItem destructive>Void…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("data-phone-sheet")).toBe("action");
    expect(screen.getByText("INV-0044")).toBeTruthy();
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Record payment", "Void…", "Cancel"]);
    expect(screen.getByRole("menuitem", { name: "Void…" }).className).toContain("text-overdue");
    await expectNoA11yViolations(document.body);
  });

  it("from 768px up the menu has no Cancel", async () => {
    asPhone(false);
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sheetTitle="INV-0044">
          <DropdownMenuItem>Record payment</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.queryByRole("menuitem", { name: "Cancel" })).toBeNull();
    expect(screen.queryByText("INV-0044")).toBeNull();
  });

  it("a select's options open in a bottom sheet", () => {
    render(
      <Select defaultValue="draft" open>
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("listbox").closest("[data-phone-sheet]")).not.toBeNull();
  });

  it("a confirmation stays a small alert, its buttons full width and stacked on a phone", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Delete draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const alert = screen.getByRole("alertdialog");
    expect(alert.hasAttribute("data-phone-fullscreen")).toBe(false);
    const footer = screen.getByRole("button", { name: "Delete draft" }).parentElement!;
    expect(footer.className).toContain("max-md:flex-col-reverse");
    expect(footer.className).toContain("max-md:[&>*]:w-full");
  });

  it("a drawer has a grabber to drag it up or down on a phone", async () => {
    render(
      <Drawer open>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle>Notifications</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );
    const grabber = screen.getByTestId("drawer-grabber");
    expect(grabber.getAttribute("aria-hidden")).toBe("true");
    expect(grabber.className).toContain("md:hidden");
    expect(screen.getByRole("dialog").className).toContain("max-md:bottom-0");
    await expectNoA11yViolations(document.body);
  });

  it("search fills the screen on a phone, with Cancel instead of the Esc key", () => {
    render(<CommandPalette open onOpenChange={() => {}} label="Search" query="" onQueryChange={() => {}} groups={[]} onSelect={() => {}} />);
    const palette = screen.getByTestId("command-palette");
    expect(palette.hasAttribute("data-phone-fullscreen")).toBe(true);
    expect(palette.className).toContain("max-md:h-dvh");
    expect(screen.getByText("Cancel").className).toContain("max-md:inline");
  });
});
