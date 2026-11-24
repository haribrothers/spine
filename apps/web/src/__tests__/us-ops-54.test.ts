import { beforeEach, describe, expect, it } from "vitest";
import { areaFor, areaHref, areaPages, isBuilder, isTopLevel, parentPath, rememberAreaPage, titleFor, visibleAreas } from "../lib/phone-shell";

/** An Owner's sidebar: every page. */
const OWNER = new Set([
  "/dashboard", "/contacts", "/leads", "/meetings", "/catalog", "/quotes", "/jobs", "/invoices", "/credit-notes", "/payments", "/receivables",
  "/vendor-bills", "/vendor-credits", "/expenses", "/vendor-payments", "/payables", "/banking", "/reports", "/journals", "/team/users", "/team/teams", "/team/audit-log",
]);
/** A Field member's sidebar (nav-sections.tsx FIELD_NAV_SECTIONS). */
const FIELD = new Set(["/dashboard", "/jobs", "/meetings", "/expenses"]);
const LABELS = new Map([["/invoices", "Invoices"], ["/quotes", "Quotes"], ["/jobs", "Jobs"], ["/reports", "Reports"], ["/team/users", "Users"]]);

describe("US-OPS-54 · get around the web app from tabs along the bottom of my phone", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("puts every page under Home, Sales, Jobs, Money or More", () => {
    expect(areaFor("/dashboard")).toBe("home");
    for (const p of ["/quotes", "/quotes/abc", "/contacts/new", "/leads", "/meetings", "/catalog"]) expect(areaFor(p)).toBe("sales");
    expect(areaFor("/jobs/abc")).toBe("jobs");
    for (const p of ["/invoices", "/invoices/abc/edit", "/payments", "/receivables", "/credit-notes", "/vendor-bills/new", "/expenses", "/payables", "/banking/x/reconcile", "/reports/profit-and-loss", "/vendor-credits", "/journals/x"])
      expect(areaFor(p)).toBe("money");
    for (const p of ["/team/users", "/activity", "/profile", "/setup"]) expect(areaFor(p)).toBe("more");
  });

  it("lists an area's pages in order, only those the person can open", () => {
    expect(areaPages("sales", OWNER)).toEqual(["/quotes", "/contacts", "/leads", "/meetings", "/catalog"]);
    expect(areaPages("money", OWNER)).toEqual(["/invoices", "/payments", "/receivables", "/credit-notes", "/vendor-bills", "/expenses", "/payables", "/banking", "/reports"]);
    expect(areaPages("sales", FIELD)).toEqual(["/meetings"]);
  });

  it("leaves out a tab with no page the person can open; More is always there", () => {
    expect(visibleAreas(OWNER)).toEqual(["home", "sales", "jobs", "money", "more"]);
    expect(visibleAreas(new Set(["/dashboard", "/jobs"]))).toEqual(["home", "jobs", "more"]);
    // A Field member: Meetings is under Sales; no Money tab, their expenses are under More.
    expect(visibleAreas(FIELD, "field")).toEqual(["home", "sales", "jobs", "more"]);
  });

  it("opens an area at the page last used there, else its first page", () => {
    expect(areaHref("sales", OWNER)).toBe("/quotes");
    expect(areaHref("money", OWNER)).toBe("/invoices");
    rememberAreaPage("/payments", "?status=unapplied");
    expect(areaHref("money", OWNER)).toBe("/payments?status=unapplied");
    // A record isn't remembered: the tab goes back to the list.
    rememberAreaPage("/payments/abc");
    expect(areaHref("money", OWNER)).toBe("/payments?status=unapplied");
    // A page the person can no longer open isn't reopened.
    expect(areaHref("money", new Set(["/invoices"]))).toBe("/invoices");
    expect(areaHref("sales", FIELD)).toBe("/meetings");
  });

  it("gives the top bar the page's title, not the logo", () => {
    expect(titleFor("/invoices", LABELS)).toBe("Invoices");
    expect(titleFor("/invoices/abc", LABELS)).toBe("Invoice");
    expect(titleFor("/invoices/new", LABELS)).toBe("New invoice");
    expect(titleFor("/quotes/abc/edit", LABELS)).toBe("Edit quote");
    expect(titleFor("/reports/profit-and-loss", LABELS)).toBe("Profit & Loss");
    expect(titleFor("/team/teams/abc", LABELS)).toBe("Team");
  });

  it("gives a record, a builder or a page below an area's first page a back arrow to its parent", () => {
    expect(isTopLevel("/invoices", OWNER)).toBe(true);
    expect(isTopLevel("/dashboard", FIELD)).toBe(true);
    expect(isTopLevel("/invoices/abc", OWNER)).toBe(false);
    expect(parentPath("/invoices/abc")).toBe("/invoices");
    expect(parentPath("/quotes/abc/edit")).toBe("/quotes");
    expect(parentPath("/reports/trial-balance")).toBe("/reports");
    expect(parentPath("/team/teams/abc")).toBe("/team/teams");
    expect(parentPath("/banking/abc/reconcile")).toBe("/banking/abc");
  });

  it("knows which pages are builders, which fill the screen without the tab bar", () => {
    expect(isBuilder("/quotes/new")).toBe(true);
    expect(isBuilder("/invoices/abc/edit")).toBe(true);
    expect(isBuilder("/invoices/abc")).toBe(false);
  });
});
