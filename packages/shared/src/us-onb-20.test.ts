import { describe, expect, it } from "vitest";
import { INDUSTRY_TEMPLATE_KEYS, INDUSTRY_TEMPLATES, industryTemplateSchema, templateSeedNote } from "./schemas/industry-template.ts";
import { templateModules } from "./modules.ts";

/** US-ONB-20 (D-193) — the industry templates and what each sets up. */
describe("US-ONB-20", () => {
  it("lists seven templates in order, each with a label and a line", () => {
    expect(INDUSTRY_TEMPLATE_KEYS.map((k) => INDUSTRY_TEMPLATES[k].label)).toEqual([
      "Construction / Contracting",
      "Interior design & fit-out",
      "Trades (electrical, plumbing, HVAC)",
      "IT services & agency",
      "Professional services",
      "General Services",
      "Generic",
    ]);
    for (const key of INDUSTRY_TEMPLATE_KEYS) expect(industryTemplateSchema.safeParse({ template: key }).success).toBe(true);
    expect(industryTemplateSchema.safeParse({ template: "retail" }).success).toBe(false);
  });

  it("gives each new template six categories and accounts with codes of their own", () => {
    const codes = new Map<string, string>();
    for (const key of ["construction", "interior_design", "trades", "it_services", "professional_services"] as const) {
      const t = INDUSTRY_TEMPLATES[key];
      expect(t.categories).toHaveLength(6);
      expect(new Set(t.categories.map((c) => c.name.toLowerCase())).size).toBe(6);
      for (const a of t.accounts) {
        expect(codes.get(a.code), `${a.code} is used by ${codes.get(a.code)}`).toBeUndefined();
        codes.set(a.code, key);
      }
    }
  });

  it("starts Professional services and Generic without Jobs & field", () => {
    expect(templateModules("professional_services").jobsField).toBe(false);
    expect(templateModules("generic").jobsField).toBe(false);
    for (const key of ["construction", "interior_design", "trades", "it_services", "general_services"]) expect(templateModules(key).jobsField).toBe(true);
  });

  it("names the template in the note on Expenses › Categories", () => {
    expect(templateSeedNote({ template: "it_services", accounts: ["5800 · Hosting & Software"], categories: ["Hosting & cloud"], kept: [] })).toBe(
      "Set up by the IT services & agency template: 1 new category and account 5800 Hosting & Software. These are ordinary categories — rename, remap or archive them like any other.",
    );
  });
});
