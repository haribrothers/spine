import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoDataStatus } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), toast: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, delete: state.delete, post: vi.fn() } }));
vi.mock("../components/toast-host", () => ({ useToast: () => state.toast }));

import { DataPane } from "../app/settings/panes/data-pane";

const loaded: DemoDataStatus = { hasDemoData: true, loaded: { country: "US", industry: "construction", businessName: "Riverstone Builders" }, country: "US", countryLocked: false };
const none: DemoDataStatus = { hasDemoData: false, loaded: null, country: "US", countryLocked: false };

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
});

async function askToDelete() {
  render(<DataPane />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete all demo data" }));
  return screen.findByRole("alertdialog", { name: "Delete all demo data?" });
}

describe("US-SET-08 · remove demo data and keep my real data", () => {
  it("with demo data loaded, says so, and that removing it never touches real data", async () => {
    state.get.mockResolvedValue(loaded);
    render(<DataPane />);
    expect(await screen.findByText("Demo data is loaded")).toBeTruthy();
    expect(screen.getByText("Removing it only deletes demo records — your real data is never touched.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete all demo data" })).toBeTruthy();
  });

  it("asks first, saying what goes, with Cancel and Delete demo data; Cancel deletes nothing", async () => {
    state.get.mockResolvedValue(loaded);
    const ask = await askToDelete();
    expect(within(ask).getByTestId("confirm-description").textContent).toMatch(/every demo contact, item, quote, invoice.*Your own records stay\. The demo people lose access\./);
    expect(within(ask).getByRole("button", { name: "Delete demo data" })).toBeTruthy();
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(state.delete).not.toHaveBeenCalled();
  });

  it("deleting removes the demo and says what happened; then the pane shows no demo data", async () => {
    state.get.mockResolvedValueOnce(loaded).mockResolvedValue(none);
    state.delete.mockResolvedValue({ kept: { contacts: 0 } });
    const ask = await askToDelete();
    fireEvent.click(within(ask).getByRole("button", { name: "Delete demo data" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Demo data deleted", "Your own records stay."));
    expect(state.delete).toHaveBeenCalledWith("/demo-data");
    expect(await screen.findByText("No demo data is currently loaded.")).toBeTruthy();
  });

  it("names a demo contact kept because my own records use it", async () => {
    state.get.mockResolvedValueOnce(loaded).mockResolvedValue(none);
    state.delete.mockResolvedValue({ kept: { contacts: 1 } });
    fireEvent.click(within(await askToDelete()).getByRole("button", { name: "Delete demo data" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Demo data deleted", "Your own records stay. Kept 1 demo contact that your own records use."));
  });

  it("says what went wrong when deleting fails, and keeps the demo shown", async () => {
    state.get.mockResolvedValue(loaded);
    state.delete.mockRejectedValue(new Error("Spine couldn't reach the server. Check your connection and try again."));
    fireEvent.click(within(await askToDelete()).getByRole("button", { name: "Delete demo data" }));
    expect(await screen.findByText("Spine couldn't reach the server. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByText("Demo data is loaded")).toBeTruthy();
    expect(state.toast).not.toHaveBeenCalled();
  });

  it("with no demo data, says so", async () => {
    state.get.mockResolvedValue(none);
    render(<DataPane />);
    expect(await screen.findByText("No demo data is currently loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load demo data" })).toBeTruthy();
  });
});
