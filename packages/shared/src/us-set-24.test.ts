import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_LABELS } from "./schemas/permissions.ts";
import { ATTENTION_KINDS } from "./schemas/attention.ts";
import { DASHBOARD_WIDGETS } from "./schemas/dashboard-widgets.ts";
import { REPORTS } from "./schemas/reports-catalog.ts";
import {
  DEFAULT_MODULES,
  MODULES,
  MODULE_KEYS,
  capabilitiesOff,
  moduleForPage,
  moduleForRoute,
  moduleOffMessage,
  ownedByOffModule,
  resolveModules,
  templateModules,
} from "./modules.ts";

describe("US-SET-24", () => {
  it("one map drives the API and the web: each page's API is refused by the same module that hides the page", () => {
    for (const key of MODULE_KEYS) {
      for (const page of MODULES[key].pages) {
        expect(moduleForPage(page), page).toBe(key);
        expect(moduleForPage(`${page}/abc`), page).toBe(key);
        // Pages and their API share a path (the recurring pages read /recurring-invoices and /recurring-bills).
        const api = page.replace("/invoices/recurring", "/recurring-invoices").replace("/vendor-bills/recurring", "/recurring-bills");
        expect(moduleForRoute(api), api).toBe(key);
      }
    }
    expect(moduleForRoute("/jobs/3b9f/milestones?x=1")).toBe("jobsField");
    expect(moduleForRoute("/meetings/upcoming")).toBe("leadsMeetings");
    expect(moduleForRoute("/expenses/7c1e/approve")).toBe("approvals");
    expect(moduleForRoute("/quotes/7c1e/approve-discount")).toBe("approvals");
    expect(moduleForRoute("/recurring-bills")).toBe("recurring");
    // Always-on parts are never refused.
    for (const path of ["/contacts", "/quotes/7c1e/send", "/invoices", "/expenses", "/expenses/7c1e", "/reports/profit-and-loss", "/jobsite"]) expect(moduleForRoute(path), path).toBeNull();
  });

  it("each module covers its whole privilege group, so the matrix hides it completely", () => {
    const group = (g: string) => CAPABILITIES.filter((c) => CAPABILITY_LABELS[c].group === g);
    for (const c of [...group("Manage Leads"), ...group("Manage Meetings")]) expect(MODULES.leadsMeetings.capabilities, c).toContain(c);
    for (const c of group("Manage Jobs")) expect(MODULES.jobsField.capabilities, c).toContain(c);
  });

  it("names only real capabilities, widgets, attention rows and reports", () => {
    const widgets = DASHBOARD_WIDGETS.map((w) => w.key) as string[];
    for (const key of MODULE_KEYS) {
      for (const c of MODULES[key].capabilities) expect(CAPABILITIES).toContain(c);
      for (const w of MODULES[key].dashboardWidgets) expect(widgets).toContain(w);
      for (const a of MODULES[key].attention) expect(ATTENTION_KINDS).toContain(a);
      for (const r of MODULES[key].reports) expect(REPORTS.map((x) => x.slug)).toContain(r);
    }
  });

  it("a switched-off module's capabilities, widgets and rows read as off; everything else is untouched", () => {
    const modules = { ...DEFAULT_MODULES, jobsField: false };
    expect(capabilitiesOff(modules).has("milestones.invoice")).toBe(true);
    expect(capabilitiesOff(modules).has("invoices.issue")).toBe(false);
    expect(ownedByOffModule(modules, "dashboardWidgets", "jobs-in-progress")).toBe(true);
    expect(ownedByOffModule(modules, "dashboardWidgets", "ar-aging")).toBe(false);
    expect(ownedByOffModule(modules, "search", "jobs")).toBe(true);
    expect(capabilitiesOff(DEFAULT_MODULES).size).toBe(0);
  });

  it("says what to do when a module is off", () => {
    expect(moduleOffMessage("jobsField")).toBe("Jobs & field is switched off. An owner can switch it on in Settings › Modules.");
  });
});

describe("US-ONB-14", () => {
  it("Generic starts without jobs; Construction and General Services with everything", () => {
    expect(templateModules("generic")).toEqual({ ...DEFAULT_MODULES, jobsField: false });
    expect(templateModules("construction")).toEqual(DEFAULT_MODULES);
    expect(templateModules("general_services")).toEqual(DEFAULT_MODULES);
  });

  it("every module is on until switched off", () => {
    expect(resolveModules(null)).toEqual(DEFAULT_MODULES);
    expect(resolveModules({ recurring: false })).toEqual({ ...DEFAULT_MODULES, recurring: false });
  });
});
