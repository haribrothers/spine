import { z } from "zod";

/** S-12.3 / US-ONB-13 — the industry templates. */
export const industryTemplateSchema = z.object({ template: z.enum(["construction", "general_services", "generic"]) });
export type IndustryTemplateValue = z.infer<typeof industryTemplateSchema>["template"];

/** US-ONB-13 (D-129) — what choosing Construction / Contracting adds. */
export const CONSTRUCTION_ACCOUNTS = [
  { code: "5300", name: "Plant & Equipment Hire" },
  { code: "5400", name: "Fuel & Freight" },
  { code: "5500", name: "Site Overheads & Permits" },
] as const;

export const CONSTRUCTION_CATEGORIES = [
  { name: "Materials", accountCode: "5000" },
  { name: "Subcontractors", accountCode: "5100" },
  { name: "Site labour", accountCode: "5200" },
  { name: "Plant & equipment hire", accountCode: "5300" },
  { name: "Fuel & freight", accountCode: "5400" },
  { name: "Site overheads & permits", accountCode: "5500" },
] as const;

export const CONSTRUCTION_TEMPLATE_NOTE = "Sets up cost categories for materials, labour, subcontractors, plant hire, fuel and freight, and site overheads.";

/** What a template run created and what it left alone ("Kept your existing account 5300 · Vehicle Lease"). */
export interface TemplateSeedResult {
  /** "5300 · Plant & Equipment Hire" */
  accounts: string[];
  /** Category names */
  categories: string[];
  kept: string[];
}

function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * The note on Expenses › Categories after the template ran: "Set up by the
 * Construction / Contracting template: 5 new categories and accounts 5300
 * Plant & Equipment Hire, … Kept your existing category “Materials”. …"
 */
export function templateSeedNote(seed: TemplateSeedResult): string | null {
  if (!seed.accounts.length && !seed.categories.length && !seed.kept.length) return null;
  const made: string[] = [];
  if (seed.categories.length) made.push(`${seed.categories.length} new ${seed.categories.length === 1 ? "category" : "categories"}`);
  if (seed.accounts.length) made.push(`${seed.accounts.length === 1 ? "account" : "accounts"} ${list(seed.accounts.map((a) => a.replace(" · ", " ")))}`);
  const parts = [`Set up by the Construction / Contracting template: ${made.length ? made.join(" and ") : "nothing new"}.`];
  if (seed.kept.length) parts.push(`${seed.kept.join(". ")}.`);
  parts.push("These are ordinary categories — rename, remap or archive them like any other.");
  return parts.join(" ");
}
