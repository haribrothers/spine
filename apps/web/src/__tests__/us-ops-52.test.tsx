import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get } }));

import { AboutPane } from "../app/settings/panes/about-pane";
import { SETTINGS_SECTIONS } from "../components/settings-dialog";

describe("US-OPS-52", () => {
  beforeEach(() => state.get.mockReset());

  it("Settings › Your account has About Spine, for everyone", () => {
    expect(SETTINGS_SECTIONS.find((s) => s.key === "about")).toMatchObject({ label: "About Spine", group: "account" });
  });

  it("shows a beta's version with a Beta label and what a beta means", async () => {
    state.get.mockResolvedValue({ status: "ok", version: "1.0.0-beta.1" });
    render(<AboutPane />);
    await waitFor(() => expect(screen.getByTestId("spine-version").textContent).toBe("Spine 1.0.0-beta.1Beta"));
    expect(screen.getByText(/This is a beta of Spine/)).toBeTruthy();
    expect(state.get).toHaveBeenCalledWith("/health");
  });

  it("a release shows just its version", async () => {
    state.get.mockResolvedValue({ status: "ok", version: "1.0.0" });
    render(<AboutPane />);
    await waitFor(() => expect(screen.getByTestId("spine-version").textContent).toBe("Spine 1.0.0"));
    expect(screen.queryByText(/This is a beta of Spine/)).toBeNull();
  });
});
