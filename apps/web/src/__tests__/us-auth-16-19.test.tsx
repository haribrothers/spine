import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ setTheme: vi.fn(), put: vi.fn(), toast: vi.fn(), setAccount: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: state.setTheme }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("../lib/api-client", () => ({ apiClient: { put: state.put } }));
vi.mock("../lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../components/toast-host", () => ({ useToast: () => state.toast }));
vi.mock("../lib/account-context", () => ({
  useAccount: () => ({ available: true, account: { id: "u1", name: "Priya Raman", email: "priya@example.com", image: "https://example.com/p.jpg" }, setAccount: state.setAccount, refresh: async () => {} }),
}));

import { AppUserMenu } from "../components/app-user-menu";
import { initials } from "../lib/initials";

/** Radix's menu opens on pointerdown, not click. */
const open = () => fireEvent.pointerDown(screen.getByRole("button", { name: "Your account: Priya Raman" }), { button: 0, ctrlKey: false });

describe("US-AUTH-16", () => {
  beforeEach(() => {
    state.setTheme.mockReset();
    state.put.mockReset();
    state.toast.mockReset();
  });

  it("saves the theme to the account as it switches", async () => {
    state.put.mockResolvedValue({ id: "u1", themePreference: "dark" });
    render(<AppUserMenu name="Priya Raman" email="priya@example.com" collapsed={false} isOwner />);
    open();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    expect(state.setTheme).toHaveBeenCalledWith("dark");
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/users/me/preferences", { themePreference: "dark" }));
    expect(screen.getByRole("menuitemradio", { name: "Follow system" })).toBeTruthy();
  });

  it("keeps the theme on this device and says so when saving fails", async () => {
    state.put.mockRejectedValue(new Error("offline"));
    render(<AppUserMenu name="Priya Raman" email="priya@example.com" collapsed={false} isOwner />);
    open();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Light" }));
    expect(state.setTheme).toHaveBeenCalledWith("light");
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Couldn't save your theme.", "It's used on this device until you sign in again."));
  });
});

describe("US-AUTH-19", () => {
  it("offers Settings to every role, Set up Spine to Owners, and Sign out", async () => {
    render(<AppUserMenu name="Sarah Mendes" email="sarah@example.com" collapsed={false} isOwner={false} />);
    open();
    expect(await screen.findByRole("menuitem", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Set up Spine" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("makes initials from a name", () => {
    expect(initials("Priya Raman")).toBe("PR");
    expect(initials("Cher")).toBe("C");
    expect(initials("  ")).toBe("?");
  });
});
