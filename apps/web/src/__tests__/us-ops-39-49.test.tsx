import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppShellNavSection } from "@spine/ui";
import type { SearchRecentResponse, SearchResponse } from "@spine/shared";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  openSettings: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  role: "owner" as string,
  capabilities: {} as Record<string, boolean>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, replace: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, post: state.post, delete: state.del } }));
vi.mock("../lib/role-context", () => ({ useMyRole: () => state.role }));
vi.mock("../lib/capabilities-context", () => ({ useCapabilities: () => ({ capabilities: state.capabilities }) }));
vi.mock("../lib/modules-context", () => ({ useModules: () => ({ modules: { leadsMeetings: true, jobsField: true, approvals: true, recurring: true } }) }));
vi.mock("../components/settings-route", () => ({ useOpenSettings: () => state.openSettings }));
vi.mock("../components/settings-dialog", () => {
  const Icon = () => <svg />;
  const SETTINGS_SECTIONS = [
    { key: "profile", label: "Profile", icon: Icon, group: "account", keywords: ["photo", "name"] },
    { key: "numbering", label: "Numbering", icon: Icon, group: "documents", keywords: ["invoice prefix", "next number"] },
    { key: "reminders", label: "Automatic reminders", icon: Icon, group: "documents", keywords: ["overdue invoices"] },
  ];
  return {
    SETTINGS_GROUPS: [
      { key: "account", label: "Your account" },
      { key: "documents", label: "Documents & emails" },
    ],
    SETTINGS_SECTIONS,
    searchSettings: (sections: typeof SETTINGS_SECTIONS, q: string) =>
      sections
        .map((section) => ({ section, matches: section.keywords.filter((k) => k.includes(q.toLowerCase())) }))
        .filter(({ section, matches }) => section.label.toLowerCase().includes(q.toLowerCase()) || matches.length > 0),
  };
});

// The palette waits 150 ms before searching, and CI runs every package's tests at once:
// give results longer than Testing Library's 1 s default to appear.
configure({ asyncUtilTimeout: 5_000 });

import { SearchButton, SearchPalette } from "../components/search-palette";
import { actionMatches, matchesWordStarts, SEARCH_ACTIONS } from "../components/search-actions";
import { recordFromLocation } from "../lib/recent-visits";

const Icon = () => <svg />;
const OWNER_SECTIONS: AppShellNavSection[] = [
  { label: "Sales", items: ["/contacts", "/leads", "/meetings", "/catalog", "/quotes"].map((href) => ({ href, label: href.slice(1), icon: <Icon /> })) },
  { label: "Billing", items: [{ href: "/invoices", label: "Invoices", icon: <Icon /> }, { href: "/receivables", label: "Receivables", icon: <Icon /> }] },
  { label: "Purchases", items: [{ href: "/vendor-bills", label: "Vendor Bills", icon: <Icon /> }, { href: "/expenses", label: "Expenses", icon: <Icon /> }] },
];
const FIELD_SECTIONS: AppShellNavSection[] = [{ label: "Work", items: ["/jobs", "/meetings", "/expenses"].map((href) => ({ href, label: href.slice(1), icon: <Icon /> })) }];

const RECENT: SearchRecentResponse = {
  items: [
    { id: "i14", type: "invoices", title: "INV-0014", subtitle: "Bluewater · $2,389.50 due", status: "Issued", href: "/invoices/i14" },
    { id: "c1", type: "contacts", title: "Harborview Construction Co.", subtitle: "Customer", status: "Contact", href: "/contacts/c1" },
  ],
  searches: ["bluewater", "2,389.50"],
};
const RESULTS: SearchResponse = {
  query: "invoice",
  groups: [{ type: "invoices", label: "Invoices", items: [{ id: "i10", type: "invoices", title: "INV-0010", subtitle: "Harbor · invoice for decking", status: "Overdue", href: "/invoices/i10" }] }],
};

function api(recent = RECENT, results = RESULTS) {
  state.get.mockImplementation((path: string) => {
    if (path === "/search/recent") return Promise.resolve(recent);
    if (path === "/org/tax/profile") return Promise.resolve({ country: "US" });
    return Promise.resolve(results);
  });
}

function open(props: Partial<React.ComponentProps<typeof SearchPalette>> = {}) {
  return render(<SearchPalette open onOpenChange={() => {}} sections={OWNER_SECTIONS} isOwner {...props} />);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  for (const fn of [state.push, state.openSettings, state.get, state.post, state.del]) fn.mockReset();
  state.post.mockResolvedValue(undefined);
  state.del.mockResolvedValue(undefined);
  state.role = "owner";
  state.capabilities = { "invoices.edit_own": true, "contacts.edit_own": true, "quotes.edit_own": true, "reports.view_financial_statements": true };
  window.localStorage.clear();
});

describe("US-OPS-39", () => {
  it("shows recent records and searches before typing; a search fills the field; Clear recent empties both", async () => {
    api();
    open();
    const recent = await screen.findByRole("option", { name: /INV-0014/ });
    expect(recent.textContent).toContain("Issued");
    expect(screen.getByText("Recent", { exact: true })).toBeTruthy();
    expect(screen.getByText("Recent searches", { exact: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: "bluewater" }));
    expect((screen.getByRole("combobox", { name: "Search" }) as HTMLInputElement).value).toBe("bluewater");

    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "" } });
    fireEvent.click(await screen.findByRole("option", { name: "Clear recent" }));
    expect(state.del).toHaveBeenCalledWith("/search/recent");
    expect(screen.queryByRole("option", { name: /INV-0014/ })).toBeNull();
    expect(await screen.findByText("Type a name, a number like INV-0010 or an amount like 2,389.50.")).toBeTruthy();
  });

  it("knows the record an address opens", () => {
    const id = "3f0b4a8e-6a7c-4b2e-9a51-5c2f1f6f2d11";
    expect(recordFromLocation(`/invoices/${id}`, new URLSearchParams())).toEqual({ type: "invoices", id });
    expect(recordFromLocation("/leads", new URLSearchParams({ lead: id }))).toEqual({ type: "leads", id });
    expect(recordFromLocation("/catalog", new URLSearchParams({ item: id }))).toEqual({ type: "catalog_items", id });
    expect(recordFromLocation("/invoices/new", new URLSearchParams())).toBeNull();
    expect(recordFromLocation("/leads", new URLSearchParams({ lead: "x" }))).toBeNull();
  });
});

describe("US-OPS-40", () => {
  it("ends each group with See all … matching, which opens its list with the search filled in", async () => {
    api();
    open();
    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "invoice" } });
    fireEvent.click(await screen.findByRole("option", { name: "See all invoices matching “invoice”" }));
    expect(state.push).toHaveBeenCalledWith("/invoices?q=invoice");
    expect(state.post).toHaveBeenCalledWith("/search/recent", { query: "invoice" });
  });
});

describe("US-OPS-41 · US-OPS-42", () => {
  it("offers actions, pages and settings this person can use, before the records", async () => {
    api();
    open();
    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "invoice" } });
    await screen.findByRole("option", { name: /INV-0010/ });
    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((h) => h.textContent);
    expect(headings).toEqual(["Actions", "Pages", "Settings", "Invoices"]);
    expect(screen.getByRole("option", { name: /New invoice/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Receivables.*unpaid invoices/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Numbering/ }));
    expect(state.openSettings).toHaveBeenCalledWith("numbering");
  });

  it("leaves out actions without the right, and business settings for Staff", async () => {
    api();
    state.role = "staff";
    state.capabilities = { "quotes.edit_own": true };
    open({ isOwner: false });
    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "invoice" } });
    await screen.findByRole("option", { name: /INV-0010/ });
    expect(screen.queryByRole("option", { name: /New invoice/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Numbering/ })).toBeNull();
  });

  it("matches the start of words, so 'har' doesn't find pages", () => {
    expect(matchesWordStarts("Vendor Bills bills purchases", "bills")).toBe(true);
    expect(matchesWordStarts("Charts", "har")).toBe(false);
    expect(actionMatches(SEARCH_ACTIONS.find((a) => a.key === "invoice")!, "new inv")).toBe(true);
    expect(SEARCH_ACTIONS.filter((a) => actionMatches(a, "record pay")).map((a) => a.label)).toEqual(["Record payment", "Record vendor payment"]);
  });
});

describe("US-OPS-46 · US-OPS-47", () => {
  it("says what it searches, bolds the match, and remembers Include archived on this device", async () => {
    api({ items: [], searches: [] });
    open();
    expect(screen.getByPlaceholderText("Search records, pages and settings")).toBeTruthy();
    expect(await screen.findByText(/^You can search contacts, leads, meetings, the catalogue, quotes, invoices, vendor bills and expenses\.$/)).toBeTruthy();
    for (const text of ["↑↓ to move", "Enter to open", "Esc to close"]) expect(screen.getByText(text)).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include archived" }));
    expect(window.localStorage.getItem("spine.search.includeArchived")).toBe("1");
    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "invoice" } });
    await waitFor(() => expect(state.get).toHaveBeenCalledWith(expect.stringContaining("includeArchived=true")));
    const row = await screen.findByRole("option", { name: /INV-0010/ });
    expect(within(row).getByText("invoice").tagName).toBe("MARK");
  });

  it("tells Field what they can search, without Include archived", async () => {
    api({ items: [], searches: [] });
    state.role = "field";
    open({ sections: FIELD_SECTIONS, isOwner: false });
    expect(await screen.findByText("You can search your meetings, jobs and expenses.")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Include archived" })).toBeNull();
  });
});

describe("US-OPS-48", () => {
  it("is a Search… field with its shortcut, or an icon when collapsed", () => {
    const { rerender } = render(<SearchButton onClick={() => {}} />);
    const field = screen.getByRole("button", { name: "Search" });
    expect(field.textContent).toContain("Search…");
    expect(field.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
    rerender(<SearchButton onClick={() => {}} collapsed />);
    expect(screen.getByRole("button", { name: "Search" }).textContent).toBe("");
  });
});

describe("US-OPS-49", () => {
  it("narrows to an area with up to 20 a group, and leaves out actions, pages and settings", async () => {
    api();
    open();
    const chips = screen.getByRole("radiogroup", { name: "Search in" });
    expect(within(chips).getAllByRole("radio").map((r) => r.textContent)).toEqual(["All", "Sales", "Billing", "Purchases"]);
    fireEvent.click(within(chips).getByRole("radio", { name: "Billing" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search" }), { target: { value: "invoice" } });
    await waitFor(() => expect(state.get).toHaveBeenCalledWith(expect.stringMatching(/limit=20&types=invoices%2Ccredit_notes%2Cpayments/)));
    await screen.findByRole("option", { name: /INV-0010/ });
    expect(screen.queryByRole("option", { name: /New invoice/ })).toBeNull();
  });
});
