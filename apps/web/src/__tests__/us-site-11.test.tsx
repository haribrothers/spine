import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ get: vi.fn(), pathname: "/invoices" }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get } }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));

import { helpPathFor, releaseNotesUrl } from "../lib/help-links";
import { HelpButton } from "../components/help-button";

const openMenu = async () => {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Help" }), { button: 0, ctrlKey: false });
  return screen.findByTestId("help-menu");
};

describe("US-SITE-11 · open help for the page I'm on", () => {
  beforeEach(() => {
    state.get.mockReset();
    state.get.mockResolvedValue({ version: "1.2.0" });
    state.pathname = "/invoices";
  });

  it("maps each page to its guide on this server, and others to the guide's start", () => {
    expect(helpPathFor("/invoices")).toBe("/help/guide/invoices/");
    expect(helpPathFor("/invoices/6f1c2b8e-3d4a-4b5c-8e9f-0a1b2c3d4e5f")).toBe("/help/guide/invoices/");
    expect(helpPathFor("/reports/gstr-1")).toBe("/help/guide/tax/");
    expect(helpPathFor("/reports/profit-and-loss")).toBe("/help/guide/reports/");
    expect(helpPathFor("/opening-balances")).toBe("/help/guide/accounts/opening-balances/");
    expect(helpPathFor("/somewhere-new")).toBe("/help/guide/");
    expect(releaseNotesUrl("1.2.0")).toBe("https://github.com/haribrothers/spine/releases/tag/v1.2.0");
  });

  it("the menu has Help for this page, User guide, What's new, Keyboard shortcuts and Online docs, and says the guide matches the version", async () => {
    render(<HelpButton collapsed={false} pageName="Invoices" />);
    const menu = await openMenu();
    await waitFor(() => expect(menu.textContent).toContain("What's new in 1.2.0"));
    for (const item of ["Help for this page", "Invoices — opens the guide on this server", "User guide", "Keyboard shortcuts", "Online docs"]) expect(menu.textContent).toContain(item);
    expect(screen.getByTestId("help-menu-footer").textContent).toBe("Spine 1.2.0 · the guide on this server matches your version");
  });

  it("Help for this page opens this page's guide from this server in a new tab; Online docs opens the website", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<HelpButton collapsed={false} pageName="Invoices" />);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Help for this page/ }));
    expect(open).toHaveBeenCalledWith("/help/guide/invoices/", "_blank", "noopener,noreferrer");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Online docs/ }));
    expect(open).toHaveBeenLastCalledWith("https://docs.h4loom.com/", "_blank", "noopener,noreferrer");
  });
});
