import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { CommandPalette, type CommandPaletteGroup } from "./command-palette";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

const groups: CommandPaletteGroup[] = [
  { heading: "Contacts", items: [{ id: "c1", title: "Harborview Construction Co.", subtitle: "Customer · Portland, ME", meta: "Contact" }] },
  {
    heading: "Invoices",
    items: [
      { id: "i1", title: "INV-0010", subtitle: "Harborview Construction Co. · $9,700.00 due", meta: "Overdue" },
      { id: "i2", title: "INV-0009", subtitle: "Harborview Construction Co. · $1,200.00", meta: "Paid" },
    ],
  },
];

function palette(props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  return (
    <CommandPalette
      open
      onOpenChange={() => {}}
      label="Search"
      query="harbor"
      onQueryChange={() => {}}
      groups={groups}
      onSelect={() => {}}
      footer={<span>Enter to open</span>}
      {...props}
    />
  );
}

describe("CommandPalette a11y", () => {
  it("has no violations open with results", async () => {
    render(palette());
    await expectNoA11yViolations(document.body);
  });

  it("has no violations with the empty message", async () => {
    render(palette({ groups: [], emptyMessage: "No results for “zzz”" }));
    await expectNoA11yViolations(document.body);
  });

  it("is a dialog named by its label, with a combobox controlling a listbox of options", () => {
    render(palette());
    expect(screen.getByRole("dialog", { name: "Search" })).toBeTruthy();
    const box = screen.getByRole("combobox", { name: "Search" });
    const listbox = screen.getByRole("listbox");
    expect(box.getAttribute("aria-controls")).toBe(listbox.id);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("moves the highlight with the arrows and announces it; Enter picks it", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(palette({ onSelect }));
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.click(box);
    await user.keyboard("{ArrowDown}");
    const active = document.getElementById(box.getAttribute("aria-activedescendant") ?? "");
    expect(active?.textContent).toContain("INV-0010");
    expect(active?.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "i1" }));
  });

  it("scales in only when motion is allowed", () => {
    render(palette());
    const dialog = screen.getByRole("dialog", { name: "Search" });
    expect(dialog.className).toContain("motion-safe:animate-palette-in");
    expect(dialog.className).not.toMatch(/(^|\s)animate-/);
  });
});

describe("CommandPalette selection", () => {
  it("highlights the first result as soon as results arrive", async () => {
    const { rerender } = render(palette({ groups: [] }));
    rerender(palette());
    const box = screen.getByRole("combobox", { name: "Search" });
    await vi.waitFor(() => {
      const active = document.getElementById(box.getAttribute("aria-activedescendant") ?? "");
      expect(active?.textContent).toContain("Harborview Construction Co.");
    });
  });
});

describe("CommandPalette focus", () => {
  it("Escape closes it and returns focus to where it was", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Before
          </button>
          <CommandPalette open={open} onOpenChange={setOpen} label="Search" query="" onQueryChange={() => {}} groups={[]} onSelect={() => {}} />
        </>
      );
    }
    render(<Harness />);
    const before = screen.getByRole("button", { name: "Before" });
    await user.click(before);
    expect(screen.getByRole("dialog", { name: "Search" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
    expect(document.activeElement).toBe(before);
  });
});
