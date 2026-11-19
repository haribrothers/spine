import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/** Makes `usePhone` (and any matchMedia check) answer as a 390px-wide phone. */
function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("US-OPS-58 · read and act on a record on my phone", () => {
  it("a record's ⋯ opens its menu as an action sheet headed by its number and a line about it", async () => {
    asPhone(true);
    const { baseElement } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">More</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sheetTitle="INV-0038" sheetDescription="Sahyadri Retail · $13,255.50 due">
          <DropdownMenuItem>Email invoice</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByText("INV-0038")).toBeTruthy();
    expect(screen.getByText("Sahyadri Retail · $13,255.50 due")).toBeTruthy();
    await expectNoA11yViolations(baseElement);
  });

  it("from 768px up the menu has no sheet heading", () => {
    asPhone(false);
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">More</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sheetTitle="INV-0038" sheetDescription="Sahyadri Retail · $13,255.50 due">
          <DropdownMenuItem>Email invoice</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.queryByText("Sahyadri Retail · $13,255.50 due")).toBeNull();
  });

  it("tabs that scroll sideways bring the chosen tab into view, without scrolling the page", async () => {
    asPhone(true);
    // A 300px row holding tabs 200px wide each: the fourth starts at 600px.
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.getAttribute("role") === "tab" ? Number(this.dataset.index) : -1;
      const left = index < 0 ? 0 : index * 200 - (this.parentElement?.scrollLeft ?? 0);
      const width = index < 0 ? 300 : 200;
      return { left, right: left + width, top: 0, bottom: 40, width, height: 40, x: left, y: 0, toJSON() {} } as DOMRect;
    });
    render(
      <Tabs defaultValue="crew">
        <TabsList aria-label="Job">
          {["milestones", "variations", "photos", "crew"].map((v, i) => (
            <TabsTrigger key={v} value={v} data-index={i}>
              {v}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="crew">Crew</TabsContent>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    await act(async () => {});
    // The fourth tab (600–800px) is now inside the 300px row.
    expect(list.scrollLeft).toBeGreaterThanOrEqual(500);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
