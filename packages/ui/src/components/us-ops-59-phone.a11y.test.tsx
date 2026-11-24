import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { AppShellPhoneBar } from "./app-shell-phone";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("US-OPS-59 · build a quote or invoice on my phone", () => {
  it("a builder's top bar has Cancel at the top left, its title, and nothing else", async () => {
    const onCancel = vi.fn();
    const { container } = render(<AppShellPhoneBar title="New quote" onCancel={onCancel} actions={<button type="button">Search</button>} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(screen.getByTestId("app-top-bar-title").textContent).toBe("New quote");
    // Cancel comes first; search and the back arrow aren't there.
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(cancel.compareDocumentPosition(screen.getByTestId("app-top-bar-title")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
    await expectNoA11yViolations(container);
  });

  it("a line's sheet has Cancel on the left, its title in the middle and Done on the right", async () => {
    const { baseElement } = render(
      <BottomSheet open onOpenChange={() => {}} title="Line 1 of 3" headerLeading={<Button variant="ghost">Cancel</Button>} headerAction={<Button variant="ghost">Done</Button>}>
        <p>Fields</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Line 1 of 3" });
    const buttons = Array.from(dialog.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttons.slice(0, 2)).toEqual(["Cancel", "Done"]);
    // No Close (×) when Done takes its place.
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Line 1 of 3" }).className).toContain("text-center");
    await expectNoA11yViolations(baseElement);
  });
});
