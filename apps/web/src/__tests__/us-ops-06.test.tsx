import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UPDATE_GUIDE_URL, type UpdateStatus } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get } }));

import { DISMISSED_UPDATE_KEY, UpdateBanner } from "../components/update-banner";

const newer: UpdateStatus = { current: "1.0.0", latest: "1.1.0", releaseUrl: "https://github.com/haribrothers/spine/releases/tag/v1.1.0", checkedAt: "2026-11-04T04:17:00Z" };

describe("US-OPS-06 · tell owners a new version is available", () => {
  beforeEach(() => {
    state.get.mockReset();
    window.localStorage.clear();
  });

  it("an Owner sees the new and current versions, What's new, How to update and a close button", async () => {
    state.get.mockResolvedValue(newer);
    render(<UpdateBanner />);
    const banner = await screen.findByTestId("update-banner");
    expect(state.get).toHaveBeenCalledWith("/org/update-status");
    expect(banner.textContent).toContain("Spine 1.1.0 is available. You're on 1.0.0. Updating runs database migrations automatically and takes a backup first.");
    expect(within(banner).getByRole("link", { name: "What's new" }).getAttribute("href")).toBe(newer.releaseUrl);
    expect(within(banner).getByRole("link", { name: "How to update" }).getAttribute("href")).toBe(UPDATE_GUIDE_URL);
    expect(within(banner).getByRole("button", { name: "Close the update notice" })).toBeTruthy();
  });

  it("once closed, it stays hidden after a reload until the next version", async () => {
    state.get.mockResolvedValue(newer);
    const first = render(<UpdateBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Close the update notice" }));
    expect(screen.queryByTestId("update-banner")).toBeNull();
    expect(window.localStorage.getItem(DISMISSED_UPDATE_KEY)).toBe("1.1.0");
    first.unmount();

    // Reload: the same version stays hidden.
    render(<UpdateBanner />);
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("a later version shows again after one was closed", async () => {
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, "1.1.0");
    state.get.mockResolvedValue({ ...newer, latest: "1.2.0" });
    render(<UpdateBanner />);
    expect((await screen.findByTestId("update-banner")).textContent).toContain("Spine 1.2.0 is available.");
  });

  it("shows nothing when up to date, with the check off (no latest), or when the request fails", async () => {
    for (const result of [() => Promise.resolve({ ...newer, latest: "1.0.0" }), () => Promise.resolve({ current: "1.0.0" }), () => Promise.reject(new Error("403"))]) {
      state.get.mockReset();
      state.get.mockImplementation(result);
      const view = render(<UpdateBanner />);
      await waitFor(() => expect(state.get).toHaveBeenCalled());
      await Promise.resolve();
      expect(screen.queryByTestId("update-banner")).toBeNull();
      view.unmount();
    }
  });
});
