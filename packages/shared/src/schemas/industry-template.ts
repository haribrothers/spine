import { z } from "zod";

/** S-12.3 / US-ONB-13 / US-ONB-20 (D-193) — the industry templates, in the order the Template step lists them. */
export const INDUSTRY_TEMPLATE_KEYS = ["construction", "interior_design", "trades", "it_services", "professional_services", "general_services", "generic"] as const;
export const industryTemplateSchema = z.object({ template: z.enum(INDUSTRY_TEMPLATE_KEYS) });
export type IndustryTemplateValue = (typeof INDUSTRY_TEMPLATE_KEYS)[number];

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

export interface IndustryTemplateDefinition {
  /** "Construction / Contracting" */
  label: string;
  /** One line under the choice on the Template step. */
  description: string;
  /** Expense accounts the template adds (codes from the default chart are reused, not repeated here). */
  accounts: readonly { code: string; name: string }[];
  categories: readonly { name: string; accountCode: string }[];
}

/**
 * US-ONB-20 (D-193) — each template's label, line and setup. Applying one
 * adds what's missing, once; existing codes and names win (D-129).
 */
export const INDUSTRY_TEMPLATES: Record<IndustryTemplateValue, IndustryTemplateDefinition> = {
  construction: {
    label: "Construction / Contracting",
    description: `Pre-enables milestones and retention on jobs, and job-costing defaults suited to site work. ${CONSTRUCTION_TEMPLATE_NOTE}`,
    accounts: CONSTRUCTION_ACCOUNTS,
    categories: CONSTRUCTION_CATEGORIES,
  },
  interior_design: {
    label: "Interior design & fit-out",
    description: "Design fees, furniture and fit-out jobs with milestones. Sets up cost categories for materials, furniture and fittings, carpenters and installers, site labour, freight and delivery, and design software and samples.",
    accounts: [
      { code: "5600", name: "Furniture & Fittings" },
      { code: "5610", name: "Freight & Delivery" },
    ],
    categories: [
      { name: "Materials", accountCode: "5000" },
      { name: "Furniture & fittings", accountCode: "5600" },
      { name: "Carpenters & installers", accountCode: "5100" },
      { name: "Site labour", accountCode: "5200" },
      { name: "Freight & delivery", accountCode: "5610" },
      { name: "Design software & samples", accountCode: "6900" },
    ],
  },
  trades: {
    label: "Trades (electrical, plumbing, HVAC)",
    description: "Call-outs, installations and maintenance contracts, with the field app for your crew. Sets up cost categories for parts and consumables, subcontractors, labour, tools and equipment, vehicle and fuel, and permits and certification.",
    accounts: [
      { code: "5700", name: "Parts & Consumables" },
      { code: "5710", name: "Tools & Equipment" },
      { code: "5720", name: "Vehicle Running" },
    ],
    categories: [
      { name: "Parts & consumables", accountCode: "5700" },
      { name: "Subcontractors", accountCode: "5100" },
      { name: "Labour", accountCode: "5200" },
      { name: "Tools & equipment", accountCode: "5710" },
      { name: "Vehicle & fuel", accountCode: "5720" },
      { name: "Permits & certification", accountCode: "6900" },
    ],
  },
  it_services: {
    label: "IT services & agency",
    description: "Projects, retainers and support for clients at home and abroad. Sets up cost categories for hosting and cloud, software subscriptions, freelancers, hardware for resale, travel, and training and certification.",
    accounts: [
      { code: "5800", name: "Hosting & Software" },
      { code: "5810", name: "Freelancers & Contractors" },
    ],
    categories: [
      { name: "Hosting & cloud", accountCode: "5800" },
      { name: "Software subscriptions", accountCode: "5800" },
      { name: "Freelancers", accountCode: "5810" },
      { name: "Hardware for resale", accountCode: "5000" },
      { name: "Travel", accountCode: "6300" },
      { name: "Training & certification", accountCode: "6900" },
    ],
  },
  professional_services: {
    label: "Professional services",
    description: "Consulting, accounting, legal or architecture: retainers and fees, without jobs to start with. Sets up cost categories for subscriptions and research, associates and subcontractors, professional fees, insurance, travel, and office supplies.",
    accounts: [
      { code: "5900", name: "Research & Subscriptions" },
      { code: "6450", name: "Professional Indemnity Insurance" },
    ],
    categories: [
      { name: "Subscriptions & research", accountCode: "5900" },
      { name: "Associates & subcontractors", accountCode: "5100" },
      { name: "Professional fees", accountCode: "6400" },
      { name: "Insurance", accountCode: "6450" },
      { name: "Travel", accountCode: "6300" },
      { name: "Office supplies", accountCode: "6900" },
    ],
  },
  general_services: {
    label: "General Services",
    description: "Sensible defaults for service-based work — no milestones/retention shown by default.",
    accounts: [],
    categories: [],
  },
  generic: {
    label: "Generic",
    description: "A neutral starting point with nothing industry-specific pre-enabled.",
    accounts: [],
    categories: [],
  },
};

/** What a template run created and what it left alone ("Kept your existing account 5300 · Vehicle Lease"). */
export interface TemplateSeedResult {
  /** The template that ran; absent on notes saved before US-ONB-20 (they were Construction's). */
  template?: IndustryTemplateValue;
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
 * The note on Expenses › Categories after a template ran: "Set up by the
 * Construction / Contracting template: 5 new categories and accounts 5300
 * Plant & Equipment Hire, … Kept your existing category “Materials”. …"
 */
export function templateSeedNote(seed: TemplateSeedResult): string | null {
  if (!seed.accounts.length && !seed.categories.length && !seed.kept.length) return null;
  const made: string[] = [];
  if (seed.categories.length) made.push(`${seed.categories.length} new ${seed.categories.length === 1 ? "category" : "categories"}`);
  if (seed.accounts.length) made.push(`${seed.accounts.length === 1 ? "account" : "accounts"} ${list(seed.accounts.map((a) => a.replace(" · ", " ")))}`);
  const label = INDUSTRY_TEMPLATES[seed.template ?? "construction"].label;
  const parts = [`Set up by the ${label} template: ${made.length ? made.join(" and ") : "nothing new"}.`];
  if (seed.kept.length) parts.push(`${seed.kept.join(". ")}.`);
  parts.push("These are ordinary categories — rename, remap or archive them like any other.");
  return parts.join(" ");
}
