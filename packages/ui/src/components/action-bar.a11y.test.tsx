import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ActionBar, ActionBarSlot } from "./action-bar";
import { Button } from "./button";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
afterEach(() => vi.unstubAllGlobals());

describe("ActionBar a11y", () => {
  it("has no violations", async () => {
    asPhone(true);
    const { container } = render(
      <ActionBar>
        <Button>Send reminder</Button>
      </ActionBar>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-58: on a phone the main action is a full-width button in the shell's bar above the tab bar", async () => {
    asPhone(true);
    render(
      <>
        <main>
          <div data-testid="actions">
            <ActionBar>
              <Button>Send reminder</Button>
            </ActionBar>
          </div>
        </main>
        <ActionBarSlot />
      </>,
    );
    const button = await screen.findByRole("button", { name: "Send reminder" });
    const bar = button.parentElement!;
    expect(bar.hasAttribute("data-action-bar")).toBe(true);
    // It's in the slot, not where the page put it.
    await vi.waitFor(() => expect(bar.parentElement!.hasAttribute("data-action-bar-slot")).toBe(true));
    expect(screen.getByTestId("actions").contains(button)).toBe(false);
    expect(bar.className).toContain("[&>*]:w-full");
  });

  it("US-OPS-58: from 768px up it's the button as it was, where it was", () => {
    asPhone(false);
    render(
      <div data-testid="actions">
        <ActionBar>
          <Button>Send reminder</Button>
        </ActionBar>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Send reminder" });
    expect(button.parentElement).toBe(screen.getByTestId("actions"));
  });
});
