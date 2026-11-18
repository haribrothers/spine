import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { BottomSheet } from "./bottom-sheet";

describe("BottomSheet a11y", () => {
  it("has no violations", async () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="Filters" footer={<button type="button">Show results</button>}>
        <p>Every filter</p>
      </BottomSheet>,
    );
    await expectNoA11yViolations(document.body);
  });

  it("US-OPS-60: is a dialog labelled by its title that Close and Escape close", () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Filters">
        <p>Every filter</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("US-OPS-60: a full-height sheet marks itself so the tab bar hides", () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="Menu" height="full">
        <p>Pages</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog").hasAttribute("data-phone-fullscreen")).toBe(true);
  });
});
