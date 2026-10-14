import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, SettingsDialog, firstSettingsPane, searchSettings } from "../components/settings-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: vi.fn(() => new Promise(() => {})), put: vi.fn(), post: vi.fn(), delete: vi.fn() }, ApiError: class extends Error {} }));
vi.mock("../lib/account-context", () => ({ useAccount: () => ({ available: true, account: null, setAccount: () => {}, refresh: async () => {} }) }));

const labels = (group: string) => SETTINGS_SECTIONS.filter((s) => s.group === group).map((s) => s.label);

describe("US-SET-30", () => {
  it("opens Owners on Business profile and everyone else on Profile", () => {
    expect(firstSettingsPane(true)).toBe("business");
    expect(firstSettingsPane(false)).toBe("profile");
  });

  it("shows Staff and Field their own account only", () => {
    render(<SettingsDialog open onOpenChange={() => {}} isOwner={false} />);
    const list = screen.getByTestId("settings-sections");
    expect(list.textContent).toContain("Your account");
    expect(list.textContent).not.toContain("Business profile");
    expect([...list.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Profile", "Password & security", "Notifications"]);
  });
});

describe("US-SET-31", () => {
  it("groups the panes in order, with Team links that open pages", () => {
    expect(SETTINGS_GROUPS.map((g) => g.label)).toEqual(["Your account", "Business", "Money & tax", "Documents & emails", "Sales & meetings", "Data", "Team"]);
    expect(labels("account")).toEqual(["Profile", "Password & security", "Notifications"]);
    expect(labels("business")).toEqual(["Business profile", "Branding", "Industry template", "Currency & locale", "Modules"]);
    expect(labels("money")).toEqual(["Financial year", "Tax", "GST", "Chart of accounts", "Opening balances", "Payment instructions"]);
    expect(labels("documents")).toEqual(["Numbering", "Documents", "Emails", "Automatic reminders"]);
    expect(labels("sales")).toEqual(["Pipeline stages", "Repeat quote conversion", "Upcoming meetings", "Meeting reminders"]);
    expect(labels("data")).toEqual(["Data export", "Demo data"]);
    expect(SETTINGS_SECTIONS.filter((s) => s.group === "team").map((s) => s.href)).toEqual(["/team/users", "/team/teams", "/team/audit-log", "/emails"]);
  });
});

describe("US-SET-34", () => {
  it("finds panes by what they contain and says what matched", () => {
    const prefix = searchSettings(SETTINGS_SECTIONS, "prefix");
    expect(prefix.map((r) => r.section.label)).toEqual(["Numbering"]);
    expect(prefix[0]!.matches).toEqual(["invoice prefix", "quote prefix"]);
    expect(searchSettings(SETTINGS_SECTIONS, "logo").map((r) => r.section.label)).toEqual(["Branding"]);
    expect(searchSettings(SETTINGS_SECTIONS, "gstin").map((r) => r.section.label)).toEqual(["Business profile", "GST"]);
    expect(searchSettings(SETTINGS_SECTIONS, "SMTP").map((r) => r.section.label)).toEqual(["Emails"]);
    expect(searchSettings(SETTINGS_SECTIONS, "password").map((r) => r.section.label)).toEqual(["Password & security"]);
    // A pane's own name matches too.
    expect(searchSettings(SETTINGS_SECTIONS, "modules")[0]!.section.key).toBe("modules");
    expect(searchSettings(SETTINGS_SECTIONS, "zzzz")).toEqual([]);
  });
});
