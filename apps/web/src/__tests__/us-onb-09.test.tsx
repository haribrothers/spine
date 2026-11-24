import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoDataStatus } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, post: state.post } }));

import { DemoBusinessDialog } from "../components/demo-business-dialog";

const empty: DemoDataStatus = { hasDemoData: false, loaded: null, country: null, countryLocked: false };

async function openAndLoad(seeded: unknown) {
  state.get.mockResolvedValue(empty);
  state.post.mockResolvedValue(seeded);
  const onLoaded = vi.fn();
  const onOpenChange = vi.fn();
  render(<DemoBusinessDialog open onOpenChange={onOpenChange} onLoaded={onLoaded} />);
  fireEvent.click(await screen.findByRole("button", { name: "Load demo business" }));
  return { onLoaded, onOpenChange };
}

beforeEach(() => {
  state.get.mockReset();
  state.post.mockReset();
});

describe("US-ONB-09 · load demo data to explore", () => {
  it("loads the demo and closes when nothing was left out", async () => {
    const { onLoaded, onOpenChange } = await openAndLoad({ businessName: "Riverstone Builders", notes: [] });
    await waitFor(() => expect(onLoaded).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(state.post).toHaveBeenCalledWith("/demo-data/seed", { country: expect.any(String), industry: "construction" });
  });

  it("says the photos were skipped when file storage wasn't reachable, then carries on with Continue", async () => {
    const { onLoaded, onOpenChange } = await openAndLoad({ businessName: "Riverstone Builders", notes: ["Photos skipped — file storage isn't reachable."] });
    expect(await screen.findByText(/is loaded\. Photos skipped — file storage isn't reachable\./)).toBeTruthy();
    expect(onLoaded).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Load demo business" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
