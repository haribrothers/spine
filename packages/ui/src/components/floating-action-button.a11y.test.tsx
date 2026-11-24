import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { FloatingActionButton } from "./floating-action-button";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
afterEach(() => vi.unstubAllGlobals());

describe("FloatingActionButton a11y", () => {
  it("has no violations", async () => {
    asPhone(true);
    const { container } = render(
      <FloatingActionButton>
        <Button>New invoice</Button>
      </FloatingActionButton>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-57: on a phone it floats as the page's main action, keeping its label", () => {
    asPhone(true);
    render(
      <FloatingActionButton>
        <Button>New invoice</Button>
      </FloatingActionButton>,
    );
    const button = screen.getByRole("button", { name: "New invoice" });
    const wrapper = button.parentElement!;
    expect(wrapper.hasAttribute("data-main-action")).toBe(true);
    expect(wrapper.className).toContain("fixed");
  });

  it("US-OPS-57: from 768px up it's the button as it was", () => {
    asPhone(false);
    render(
      <FloatingActionButton>
        <Button>New invoice</Button>
      </FloatingActionButton>,
    );
    expect(screen.getByRole("button", { name: "New invoice" }).parentElement!.hasAttribute("data-main-action")).toBe(false);
  });
});
