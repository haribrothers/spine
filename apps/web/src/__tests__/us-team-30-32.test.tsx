import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITIES, DEFAULT_MODULES, type Capability } from "@spine/shared";
import { navSectionsFor } from "../lib/nav-sections";
import { pageAccessFor } from "../lib/page-access";
import { applyToDraft, sectionChangeLine, sectionChanges, sectionSwitches, sectionsOpened, waitsFor } from "../app/(app)/team/teams/teams-state";
import { SectionLink } from "../components/section-link";

const state = vi.hoisted(() => ({ role: "staff" as string | null, capabilities: {} as Partial<Record<string, boolean>> | null }));
vi.mock("../lib/role-context", () => ({ useMyRole: () => state.role }));
vi.mock("../lib/capabilities-context", () => ({ useCapabilities: () => ({ capabilities: state.capabilities, loading: false }) }));

const allOn = Object.fromEntries(CAPABILITIES.map((c) => [c, true])) as Record<Capability, boolean>;
const without = (...caps: Capability[]) => ({ ...allOn, ...Object.fromEntries(caps.map((c) => [c, false])) }) as Record<Capability, boolean>;
const hrefs = (role: string, caps: Partial<Record<Capability, boolean>>) => navSectionsFor(role, caps, DEFAULT_MODULES).flatMap((s) => s.items.map((i) => i.href));

describe("US-TEAM-30", () => {
  it("takes a closed section out of a Staff member's sidebar and shows its pages as no access", () => {
    const caps = without("quotes.open");
    expect(hrefs("staff", caps)).not.toContain("/quotes");
    expect(hrefs("staff", caps)).toContain("/invoices");
    expect(pageAccessFor("/quotes/q1", "staff", caps)).toMatchObject({ state: "denied", pageName: "Quotes", ownerOnly: false });
    expect(pageAccessFor("/invoices", "staff", caps)).toEqual({ state: "allowed" });
  });

  it("keeps Expenses open without “See everyone's expenses” — their own stay", () => {
    const caps = without("expenses.view_others");
    expect(hrefs("staff", caps)).toContain("/expenses");
    expect(pageAccessFor("/expenses", "staff", caps)).toEqual({ state: "allowed" });
  });

  it("leaves Owners and Field as they were", () => {
    expect(hrefs("owner", {})).toContain("/quotes");
    expect(pageAccessFor("/jobs/j1", "field", {})).toEqual({ state: "allowed" });
    expect(pageAccessFor("/meetings", "field", {})).toEqual({ state: "allowed" });
    expect(pageAccessFor("/quotes", "field", {})).toMatchObject({ state: "denied" });
  });

  it("turns a section's Open on with an action, and its actions off with it", () => {
    const none = Object.fromEntries(CAPABILITIES.map((c) => [c, false])) as Record<Capability, boolean>;
    expect(applyToDraft(none, [{ capability: "quotes.edit_own", granted: true }])["quotes.open"]).toBe(true);
    const closed = applyToDraft(allOn, [{ capability: "quotes.open", granted: false }]);
    expect(closed["quotes.edit_own"]).toBe(false);
    expect(closed["quotes.send"]).toBe(false);
    expect(closed["invoices.edit_own"]).toBe(true);
    // Approving others' expenses needs seeing them.
    expect(applyToDraft(allOn, [{ capability: "expenses.view_others", granted: false }])["expenses.approve"]).toBe(false);
  });
});

describe("US-TEAM-31", () => {
  beforeEach(() => {
    state.role = "staff";
    state.capabilities = without("quotes.open");
  });

  it("shows a record in a closed section as plain text with a lock, and others as links", () => {
    render(
      <p>
        <SectionLink href="/quotes/q1" data-testid="quote">QUO-0012</SectionLink>
        <SectionLink href="/invoices/i1?tab=payments" data-testid="invoice">INV-0031</SectionLink>
      </p>,
    );
    const quote = screen.getByTestId("quote");
    expect(quote.tagName).toBe("SPAN");
    expect(quote.textContent).toBe("QUO-0012 (Quotes is closed for your Team)");
    expect(screen.getByTestId("invoice").tagName).toBe("A");
  });

  it("links everything for an Owner", () => {
    state.role = "owner";
    render(<SectionLink href="/quotes/q1" data-testid="quote">QUO-0012</SectionLink>);
    expect(screen.getByTestId("quote").tagName).toBe("A");
  });
});

describe("US-TEAM-32", () => {
  it("lists the sections with a switch and where members stand, in sidebar order", () => {
    // Pipeline closed; Quotes open with nothing allowed there.
    const draft = without("leads.open", ...CAPABILITIES.filter((c) => c.startsWith("quotes.") && c !== "quotes.open"));
    const rows = sectionSwitches(draft, DEFAULT_MODULES);
    expect(rows.map((r) => r.section)).toEqual(["Contacts", "Pipeline", "Meetings", "Catalogue", "Quotes", "Jobs", "Invoices", "Credit Notes", "Payments", "Vendor Bills", "Vendor Credits", "Vendor Payments"]);
    expect(rows.find((r) => r.section === "Pipeline")).toMatchObject({ on: false, access: "none" });
    expect(rows.find((r) => r.section === "Contacts")).toMatchObject({ on: true, access: "work" });
  });

  it("says an action waits for its section, and what the save does to sections", () => {
    const closed = without("quotes.open");
    expect(waitsFor("quotes.edit_own", closed)).toBe("Open Quotes first.");
    expect(waitsFor("quotes.edit_own", allOn)).toBeNull();
    expect(waitsFor("expenses.approve", without("expenses.view_others"))).toBe("Turn on “See everyone's expenses” first.");
    expect(waitsFor("banking.reconcile", without("banking.view"))).toBeNull();

    const before = sectionsOpened(Object.keys(allOn), DEFAULT_MODULES);
    const after = sectionsOpened(Object.keys(applyToDraft(allOn, [{ capability: "quotes.open", granted: false }])).filter((c) => c !== "quotes.open" && !c.startsWith("quotes.")), DEFAULT_MODULES);
    const moved = sectionChanges(before, after);
    expect(moved).toEqual([expect.objectContaining({ href: "/quotes", was: "work", access: "none", up: false })]);
    expect(sectionChangeLine("work", "none")).toBe("They'll no longer see");
    expect(sectionChangeLine("none", "view")).toBe("They'll see");
  });
});
