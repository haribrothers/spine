import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activities, addresses, catalogItems, contactPersons, contacts, invoices, jobs, journalLines, leads, payments, quotes, settings } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { QuotesService } from "../quotes/quotes.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { JobsService } from "../jobs/jobs.service";
import { MilestonesService } from "../jobs/milestones.service";
import { SettingsService } from "../org/settings.service";

/**
 * S-12.8/F12 — "load demo data" now also seeds the org's own identity
 * (`business_profile`/`industry_template`/`currency`, per `SettingsService`'s
 * own doc comment on their shapes), not just contacts/catalogue/quotes/
 * invoices/payments. Previously a demo org had no name/address/industry at
 * all — every quote/invoice PDF's header rendered blank, and Settings'
 * Business/Template panes showed nothing, even though the rest of the org
 * looked fully populated. No logo — seeding a fake one would need a real
 * S3/MinIO upload through `FilesService` from inside a seed script, which
 * is real scope no story asked for; the PDF header degrades to text-only
 * with no logo exactly as it already does for any real org that hasn't
 * uploaded one, so this isn't a functional gap, just a cosmetic one.
 * "Construction" is picked for the template/currency to match the DEMO_
 * CONTACTS/DEMO_CATALOG_ITEMS below, which are already construction-themed
 * (site surveys, framing lumber, concrete, etc.) — a demo org that looked
 * construction-flavored in its data but was tagged "generic" in Settings
 * would be a confusing mismatch for anyone evaluating the industry-template
 * feature specifically.
 */
const DEMO_BUSINESS_PROFILE = {
  name: "Riverstone Builders",
  address: "220 Timberline Ave, Suite 4, Burlington, VT 05401",
  industry: "General contracting & construction",
};
const DEMO_INDUSTRY_TEMPLATE = { template: "construction" as const };
const DEMO_CURRENCY = { code: "USD", locale: "en-US" };

type DemoContactSeed = {
  type: "customer" | "vendor" | "both";
  isCompany: boolean;
  name: string;
  email: string;
  phone: string;
  taxId?: string;
  website?: string;
  person: { name: string; title: string; email: string; phone: string };
  address: { line1: string; city: string; state: string; postalCode: string; country: string };
  lead: { stage: "new" | "qualified" | "proposal" | "won" | "lost"; valueAmount: bigint; title: string; source: string };
  activity: { type: "call" | "meeting" | "note" | "task"; notes: string; dueInDays: number };
};

const DEMO_CONTACTS: DemoContactSeed[] = [
  {
    type: "customer", isCompany: true, name: "Harborview Construction Co.", email: "accounts@harborviewco.example", phone: "+1-555-0101", taxId: "TX-10045512", website: "https://harborviewco.example",
    person: { name: "Alan Reyes", title: "Procurement Manager", email: "alan.reyes@harborviewco.example", phone: "+1-555-0111" },
    address: { line1: "48 Harbor Way", city: "Portland", state: "ME", postalCode: "04101", country: "US" },
    lead: { stage: "proposal", valueAmount: 4850000n, title: "Marina office fit-out", source: "Referral" },
    activity: { type: "call", notes: "Discussed timeline for the marina office fit-out proposal.", dueInDays: 3 },
  },
  {
    type: "customer", isCompany: true, name: "Maple Ridge Developments", email: "billing@mapleridge.example", phone: "+1-555-0102", website: "https://mapleridge.example",
    person: { name: "Sarah Kim", title: "Site Manager", email: "sarah.kim@mapleridge.example", phone: "+1-555-0112" },
    address: { line1: "220 Ridge Rd", city: "Burlington", state: "VT", postalCode: "05401", country: "US" },
    lead: { stage: "qualified", valueAmount: 1250000n, title: "Phase 2 townhomes", source: "Website" },
    activity: { type: "meeting", notes: "Site walkthrough for Phase 2 townhome foundations.", dueInDays: 5 },
  },
  {
    type: "customer", isCompany: false, name: "Priya Nair", email: "priya.nair@example.com", phone: "+1-555-0103",
    person: { name: "Priya Nair", title: "Homeowner", email: "priya.nair@example.com", phone: "+1-555-0103" },
    address: { line1: "12 Willow St", city: "Concord", state: "NH", postalCode: "03301", country: "US" },
    lead: { stage: "won", valueAmount: 38000n, title: "Kitchen renovation", source: "Referral" },
    activity: { type: "task", notes: "Send final invoice for kitchen renovation.", dueInDays: -2 },
  },
  {
    type: "customer", isCompany: true, name: "Sunstone Retail Fitouts", email: "ap@sunstoneretail.example", phone: "+1-555-0104", taxId: "TX-88213340",
    person: { name: "Marcus Ellison", title: "Store Ops Director", email: "marcus.ellison@sunstoneretail.example", phone: "+1-555-0113" },
    address: { line1: "900 Commerce Blvd", city: "Nashua", state: "NH", postalCode: "03060", country: "US" },
    lead: { stage: "new", valueAmount: 620000n, title: "Storefront remodel — 3 locations", source: "Trade show" },
    activity: { type: "note", notes: "Requested a rough budget range before scheduling a site visit.", dueInDays: 7 },
  },
  {
    type: "customer", isCompany: false, name: "David Chen", email: "david.chen@example.com", phone: "+1-555-0105",
    person: { name: "David Chen", title: "Homeowner", email: "david.chen@example.com", phone: "+1-555-0105" },
    address: { line1: "77 Birchwood Ave", city: "Manchester", state: "NH", postalCode: "03101", country: "US" },
    lead: { stage: "lost", valueAmount: 15500n, title: "Deck rebuild", source: "Website" },
    activity: { type: "note", notes: "Went with another contractor — budget mismatch.", dueInDays: -10 },
  },
  {
    type: "customer", isCompany: true, name: "Ironclad Fabrication Ltd.", email: "orders@ironcladfab.example", phone: "+1-555-0106", taxId: "TX-55190021", website: "https://ironcladfab.example",
    person: { name: "Teresa Lopez", title: "Purchasing Lead", email: "teresa.lopez@ironcladfab.example", phone: "+1-555-0114" },
    address: { line1: "14 Foundry Ln", city: "Worcester", state: "MA", postalCode: "01608", country: "US" },
    lead: { stage: "proposal", valueAmount: 980000n, title: "Structural steel supply contract", source: "Cold outreach" },
    activity: { type: "call", notes: "Walked through steel spec sheet and delivery schedule.", dueInDays: 2 },
  },
  {
    type: "customer", isCompany: true, name: "Bluewater Hospitality Group", email: "procurement@bluewaterhg.example", phone: "+1-555-0107",
    person: { name: "Nathan Brooks", title: "Facilities Manager", email: "nathan.brooks@bluewaterhg.example", phone: "+1-555-0115" },
    address: { line1: "5 Waterfront Plz", city: "Providence", state: "RI", postalCode: "02903", country: "US" },
    lead: { stage: "qualified", valueAmount: 2100000n, title: "Hotel lobby renovation", source: "Referral" },
    activity: { type: "meeting", notes: "Presented mood boards and material options for the lobby.", dueInDays: 6 },
  },
  {
    type: "vendor", isCompany: true, name: "Apex Timber Supply", email: "sales@apextimber.example", phone: "+1-555-0201", taxId: "TX-30012234",
    person: { name: "Greg Foster", title: "Account Rep", email: "greg.foster@apextimber.example", phone: "+1-555-0211" },
    address: { line1: "600 Mill Rd", city: "Bangor", state: "ME", postalCode: "04401", country: "US" },
    lead: { stage: "won", valueAmount: 0n, title: "Preferred lumber supplier agreement", source: "Existing relationship" },
    activity: { type: "call", notes: "Confirmed Q3 pricing for framing lumber.", dueInDays: 14 },
  },
  {
    type: "vendor", isCompany: true, name: "Granite State Concrete", email: "orders@granitestateconcrete.example", phone: "+1-555-0202",
    person: { name: "Linda Park", title: "Dispatch Coordinator", email: "linda.park@granitestateconcrete.example", phone: "+1-555-0212" },
    address: { line1: "88 Quarry Rd", city: "Concord", state: "NH", postalCode: "03301", country: "US" },
    lead: { stage: "won", valueAmount: 0n, title: "Standing ready-mix delivery order", source: "Existing relationship" },
    activity: { type: "note", notes: "Confirmed delivery slot for next pour.", dueInDays: 4 },
  },
  {
    type: "vendor", isCompany: true, name: "Northline Electrical Wholesale", email: "sales@northlineelectrical.example", phone: "+1-555-0203", website: "https://northlineelectrical.example",
    person: { name: "Omar Haddad", title: "Sales Rep", email: "omar.haddad@northlineelectrical.example", phone: "+1-555-0213" },
    address: { line1: "301 Industrial Pkwy", city: "Lowell", state: "MA", postalCode: "01852", country: "US" },
    lead: { stage: "qualified", valueAmount: 42000n, title: "Panel + conduit bulk order", source: "Cold outreach" },
    activity: { type: "task", notes: "Follow up on bulk conduit pricing quote.", dueInDays: 3 },
  },
  {
    type: "vendor", isCompany: true, name: "Coastal Steel & Metal Works", email: "sales@coastalsteel.example", phone: "+1-555-0204", taxId: "TX-71230098",
    person: { name: "Jenna Ortiz", title: "Sales Manager", email: "jenna.ortiz@coastalsteel.example", phone: "+1-555-0214" },
    address: { line1: "19 Shipyard Dr", city: "New Bedford", state: "MA", postalCode: "02740", country: "US" },
    lead: { stage: "new", valueAmount: 76000n, title: "Custom railing fabrication", source: "Website" },
    activity: { type: "call", notes: "Requested drawings for custom railing spec.", dueInDays: 5 },
  },
  {
    type: "vendor", isCompany: false, name: "Marcus Webb (Freelance Surveyor)", email: "marcus.webb@example.com", phone: "+1-555-0205",
    person: { name: "Marcus Webb", title: "Land Surveyor", email: "marcus.webb@example.com", phone: "+1-555-0205" },
    address: { line1: "9 Meridian Ct", city: "Keene", state: "NH", postalCode: "03431", country: "US" },
    lead: { stage: "won", valueAmount: 4200n, title: "Boundary survey — Maple Ridge site", source: "Referral" },
    activity: { type: "note", notes: "Survey report delivered, filed with permit application.", dueInDays: -5 },
  },
  {
    type: "both", isCompany: true, name: "Ridgeline Equipment Rental", email: "info@ridgelineequip.example", phone: "+1-555-0301", website: "https://ridgelineequip.example",
    person: { name: "Chris Dalton", title: "Rental Coordinator", email: "chris.dalton@ridgelineequip.example", phone: "+1-555-0311" },
    address: { line1: "410 Depot St", city: "Springfield", state: "MA", postalCode: "01103", country: "US" },
    lead: { stage: "qualified", valueAmount: 18500n, title: "Monthly excavator rental", source: "Existing relationship" },
    activity: { type: "task", notes: "Renew equipment rental agreement before month-end.", dueInDays: 9 },
  },
  {
    type: "both", isCompany: true, name: "Summit Glass & Glazing", email: "hello@summitglazing.example", phone: "+1-555-0302", taxId: "TX-62047781",
    person: { name: "Elena Rossi", title: "Estimator", email: "elena.rossi@summitglazing.example", phone: "+1-555-0312" },
    address: { line1: "77 Summit Ave", city: "Hartford", state: "CT", postalCode: "06103", country: "US" },
    lead: { stage: "proposal", valueAmount: 310000n, title: "Curtain wall glazing subcontract", source: "Trade show" },
    activity: { type: "meeting", notes: "Reviewed glazing subcontract scope and pricing.", dueInDays: 4 },
  },
];

const DEMO_CATALOG_ITEMS: {
  name: string;
  description: string;
  unit: string;
  category: string;
  priceAmount: bigint;
}[] = [
  { name: "Site survey & assessment", description: "Initial site visit, measurements, and feasibility notes.", unit: "each", category: "Consulting", priceAmount: 25000n },
  { name: "General labour", description: "Skilled labour, billed hourly.", unit: "hour", category: "Labour", priceAmount: 6500n },
  { name: "Project management", description: "On-site and remote project coordination.", unit: "hour", category: "Labour", priceAmount: 9500n },
  { name: "Framing lumber (2x4x8)", description: "Kiln-dried SPF framing stud.", unit: "each", category: "Materials", priceAmount: 850n },
  { name: "Ready-mix concrete", description: "Standard-strength ready-mix, delivered.", unit: "cubic yard", category: "Materials", priceAmount: 18000n },
  { name: "Structural steel beam", description: "Fabricated to spec, per linear foot.", unit: "linear ft", category: "Materials", priceAmount: 4200n },
  { name: "Electrical rough-in", description: "Rough wiring for a standard room.", unit: "room", category: "Electrical", priceAmount: 45000n },
  { name: "Plumbing fixture installation", description: "Supply and install a standard fixture.", unit: "each", category: "Plumbing", priceAmount: 32000n },
  { name: "Drywall installation & finishing", description: "Hang, tape, and finish to level 4.", unit: "sq ft", category: "Interior", priceAmount: 350n },
  { name: "Interior painting", description: "Two-coat interior paint, walls and trim.", unit: "sq ft", category: "Interior", priceAmount: 250n },
  { name: "Flooring installation (LVP)", description: "Supply and install luxury vinyl plank.", unit: "sq ft", category: "Interior", priceAmount: 600n },
  { name: "Window installation", description: "Standard vinyl window, supply and install.", unit: "each", category: "Exterior", priceAmount: 65000n },
  { name: "Roofing (asphalt shingle)", description: "Tear-off and reroof with architectural shingle.", unit: "square", category: "Exterior", priceAmount: 42000n },
  { name: "Equipment rental — mini excavator", description: "Daily rental rate.", unit: "day", category: "Equipment", priceAmount: 35000n },
  { name: "Waste disposal & site cleanup", description: "Dumpster rental and final site cleanup.", unit: "each", category: "Services", priceAmount: 55000n },
];

type DemoQuoteLineSeed = {
  /** Index into DEMO_CATALOG_ITEMS — resolved to a real catalogItemId/name/unit/price/tax after that array is seeded. */
  catalogItemIndex: number;
  quantity: number;
  discountPercentage?: number;
};

type DemoQuoteSeed = {
  /** Index into DEMO_CONTACTS. */
  contactIndex: number;
  validUntilInDays: number;
  notes?: string;
  termsAndConditions?: string;
  lines: DemoQuoteLineSeed[];
  /** "draft" leaves it unsent; "sent" also calls QuotesService.send; "revised" sends then revises into a v2 draft, to showcase S-03.8's versioning in the demo set. */
  outcome: "draft" | "sent" | "revised";
};

/**
 * Five quotes spanning the states Stage 1 can actually reach through its
 * own public methods — draft, sent, and a sent quote revised into a v2
 * draft (S-03.8). Deliberately does NOT fabricate `accepted`/`rejected`
 * status: those transitions only exist via Stage 3's not-yet-built public
 * accept/reject action (see quotes.ts's schema comment), and hand-writing
 * that status directly would misrepresent what this stage of the product
 * can actually do. One quote (index 1) carries a discount above the
 * default 20% approval threshold and is deliberately left unapproved and
 * un-sent, so the demo set also shows S-03.9's approval gate in action
 * (the "Send" action on it will correctly refuse until an owner approves).
 */
const DEMO_QUOTES: DemoQuoteSeed[] = [
  {
    contactIndex: 0, // Harborview Construction Co.
    validUntilInDays: 30,
    notes: "Marina office fit-out — phase 1 scope as discussed on site.",
    termsAndConditions: "50% deposit on acceptance, balance on completion. Prices valid for 30 days.",
    lines: [
      { catalogItemIndex: 0, quantity: 1 }, // Site survey & assessment
      { catalogItemIndex: 1, quantity: 80 }, // General labour
      { catalogItemIndex: 8, quantity: 600 }, // Drywall installation & finishing
      { catalogItemIndex: 9, quantity: 600 }, // Interior painting
    ],
    outcome: "sent",
  },
  {
    contactIndex: 1, // Maple Ridge Developments
    validUntilInDays: 21,
    notes: "Phase 2 townhome foundations — bulk materials pricing applied.",
    lines: [
      // Discount applied to both material lines (not just one) so the
      // BLENDED discount across the whole quote — what discountRequiresApproval
      // actually checks, not any single line — clears the default 20%
      // threshold; a discount on only one out of three lines doesn't
      // necessarily do that once weighted by each line's own amount.
      { catalogItemIndex: 4, quantity: 40, discountPercentage: 32 }, // Ready-mix concrete, bulk discount
      { catalogItemIndex: 5, quantity: 200, discountPercentage: 32 }, // Structural steel beam, bulk discount
      { catalogItemIndex: 1, quantity: 120 }, // General labour, no discount
    ],
    outcome: "draft",
  },
  {
    contactIndex: 3, // Sunstone Retail Fitouts
    validUntilInDays: 14,
    notes: "Storefront remodel — location 1 of 3, remaining locations to follow as separate quotes.",
    termsAndConditions: "Prices valid for 14 days. Scheduling subject to permit approval.",
    lines: [
      { catalogItemIndex: 0, quantity: 1 }, // Site survey & assessment
      { catalogItemIndex: 2, quantity: 24 }, // Project management
      { catalogItemIndex: 11, quantity: 6 }, // Window installation
      { catalogItemIndex: 10, quantity: 900 }, // Flooring installation (LVP)
    ],
    outcome: "sent",
  },
  {
    contactIndex: 6, // Bluewater Hospitality Group
    validUntilInDays: 45,
    notes: "Hotel lobby renovation — revised scope after design review, see v2 for current pricing.",
    termsAndConditions: "50% deposit on acceptance. Prices valid for 45 days.",
    lines: [
      { catalogItemIndex: 2, quantity: 60 }, // Project management
      { catalogItemIndex: 9, quantity: 1400 }, // Interior painting
      { catalogItemIndex: 10, quantity: 1200 }, // Flooring installation (LVP)
    ],
    outcome: "revised",
  },
  {
    contactIndex: 11, // Summit Glass & Glazing
    validUntilInDays: 10,
    notes: "Curtain wall glazing subcontract — draft pending final measurements.",
    lines: [
      { catalogItemIndex: 6, quantity: 3 }, // Electrical rough-in
      { catalogItemIndex: 1, quantity: 40 }, // General labour
    ],
    outcome: "draft",
  },
];

type DemoInvoiceLineSeed = {
  /** Index into DEMO_CATALOG_ITEMS. */
  catalogItemIndex: number;
  quantity: number;
};

type DemoInvoiceSeed = {
  /** Index into DEMO_CONTACTS. */
  contactIndex: number;
  dueInDays: number;
  notes?: string;
  lines: DemoInvoiceLineSeed[];
  /** "draft" leaves it unissued. "issued" issues it with no payment yet (shows up as fully outstanding, and overdue if dueInDays is negative). "partiallyPaid" issues it then records one payment for part of the total. "paidInFull" issues it then pays it off completely. "voided" issues it then voids it with a reason — demonstrates S-05.8's reversing entry in the demo set. */
  outcome: "draft" | "issued" | "partiallyPaid" | "paidInFull" | "voided";
  /** Only meaningful for "partiallyPaid" — fraction (0-1) of the total to pay. */
  partialPaymentFraction?: number;
};

/**
 * PRD §11.3's own seed-data spec calls for "invoices in every status" and
 * "invoices with partial payments" — this covers everything Phase 2 ·
 * Money In can actually produce today (draft/issued/void, plus partial and
 * full payment via real allocations). Retention and jobs are explicitly
 * NOT faked here — those require Phase 3 (Jobs & Construction Billing),
 * which doesn't exist yet; fabricating a retention amount on a demo
 * invoice today would misrepresent what the product can currently do, the
 * same principle DEMO_QUOTES' own comment applies to accepted/rejected
 * quote status.
 *
 * Reuses catalogue items/contacts already seeded above by index, same
 * convention as DEMO_QUOTES. Each invoice is independent of the demo
 * quotes (no `sourceQuoteId` wiring to a specific seeded quote) — S-03.10
 * (quote → invoice conversion) isn't built yet, so there is no real
 * conversion action to seed through; wiring a fake `sourceQuoteId` by hand
 * would claim a conversion happened that didn't.
 */
const DEMO_INVOICES: DemoInvoiceSeed[] = [
  {
    contactIndex: 2, // Priya Nair — kitchen renovation, won lead
    dueInDays: -12,
    notes: "Kitchen renovation — final invoice.",
    lines: [
      { catalogItemIndex: 1, quantity: 60 }, // General labour
      { catalogItemIndex: 10, quantity: 220 }, // Flooring installation (LVP)
      { catalogItemIndex: 9, quantity: 350 }, // Interior painting
    ],
    outcome: "paidInFull",
  },
  {
    contactIndex: 0, // Harborview Construction Co.
    dueInDays: -5,
    notes: "Marina office fit-out — progress bill 1 of 3.",
    lines: [
      { catalogItemIndex: 1, quantity: 100 }, // General labour
      { catalogItemIndex: 8, quantity: 400 }, // Drywall installation & finishing
    ],
    outcome: "partiallyPaid",
    partialPaymentFraction: 0.5,
  },
  {
    contactIndex: 6, // Bluewater Hospitality Group
    dueInDays: 21,
    notes: "Hotel lobby renovation — deposit invoice.",
    lines: [{ catalogItemIndex: 2, quantity: 20 }], // Project management
    outcome: "issued",
  },
  {
    contactIndex: 3, // Sunstone Retail Fitouts
    dueInDays: 30,
    notes: "Storefront remodel — location 1, draft pending final measurements.",
    lines: [
      { catalogItemIndex: 11, quantity: 4 }, // Window installation
      { catalogItemIndex: 14, quantity: 1 }, // Waste disposal & site cleanup
    ],
    outcome: "draft",
  },
  {
    contactIndex: 12, // Ridgeline Equipment Rental (both customer+vendor)
    dueInDays: 15,
    notes: "Duplicate billing — voided, corrected invoice raised separately.",
    lines: [{ catalogItemIndex: 13, quantity: 5 }], // Equipment rental — mini excavator
    outcome: "voided",
  },
];

type DemoMilestoneSeed = {
  name: string;
  amountType: "fixed" | "percent";
  amount: number;
  dueInDays: number;
};

type DemoJobSeed = {
  /** Index into DEMO_CONTACTS. */
  contactIndex: number;
  name: string;
  siteAddress: string;
  contractValueAmount: bigint;
  retentionPct: number;
  startInDays: number;
  milestones: DemoMilestoneSeed[];
  /**
   * "active": milestones defined, none touched — a job just getting
   * started. "inProgress": first milestone marked complete and invoiced
   * (issued) — shows retention actually held on a real posted invoice.
   * "nearingCompletion": same as inProgress, PLUS the second milestone also
   * completed+invoiced — two progress invoices in, most of the contract
   * billed, retention accumulating across both. "retentionReleased": same
   * as nearingCompletion, plus every milestone is completed+invoiced and
   * retention has been released via a real retention-release invoice —
   * the full S-04.1→S-04.7 lifecycle in one seeded job.
   */
  outcome: "active" | "inProgress" | "nearingCompletion" | "retentionReleased";
};

/**
 * PRD §11.3's own seed-data spec calls for "3 jobs at different stages"
 * and "retention" — three jobs, each further along S-04.1→S-04.7's
 * lifecycle than the last, all using the real `JobsService`/
 * `MilestonesService`/`InvoicesService` methods a real user's actions
 * would call (same "seed via the real service" principle as
 * `seedQuotes`/`seedInvoices` above), so a seeded "nearingCompletion" job
 * has genuine progress-invoice numbers and real §7.2 retention postings,
 * not hand-set columns. Every job here uses `amountType: "percent"`
 * milestones (summing to 100%) rather than fixed amounts, since that's
 * the more construction-typical billing shape and exercises S-04.3's
 * percentage-total validation for real on every seed run.
 */
const DEMO_JOBS: DemoJobSeed[] = [
  {
    contactIndex: 0, // Harborview Construction Co.
    name: "Marina office fit-out",
    siteAddress: "48 Harbor Way, Portland, ME 04101",
    contractValueAmount: 4850000n,
    retentionPct: 5,
    startInDays: -14,
    milestones: [
      { name: "Mobilisation & site setup", amountType: "percent", amount: 20, dueInDays: 7 },
      { name: "Framing & rough-in complete", amountType: "percent", amount: 40, dueInDays: 30 },
      { name: "Final fit-out & handover", amountType: "percent", amount: 40, dueInDays: 60 },
    ],
    outcome: "active",
  },
  {
    contactIndex: 1, // Maple Ridge Developments
    name: "Phase 2 townhomes — foundations",
    siteAddress: "220 Ridge Rd, Burlington, VT 05401",
    contractValueAmount: 1250000n,
    retentionPct: 10,
    startInDays: -45,
    milestones: [
      { name: "Excavation & footings", amountType: "percent", amount: 35, dueInDays: -20 },
      { name: "Foundation walls poured", amountType: "percent", amount: 35, dueInDays: 10 },
      { name: "Backfill & inspection sign-off", amountType: "percent", amount: 30, dueInDays: 25 },
    ],
    outcome: "nearingCompletion",
  },
  {
    contactIndex: 6, // Bluewater Hospitality Group
    name: "Hotel lobby renovation",
    siteAddress: "5 Waterfront Plz, Providence, RI 02903",
    contractValueAmount: 2100000n,
    retentionPct: 8,
    startInDays: -120,
    milestones: [
      { name: "Demolition & prep", amountType: "percent", amount: 25, dueInDays: -100 },
      { name: "Millwork & finishes installed", amountType: "percent", amount: 50, dueInDays: -60 },
      { name: "Final walkthrough & sign-off", amountType: "percent", amount: 25, dueInDays: -30 },
    ],
    outcome: "retentionReleased",
  },
];

/**
 * Onboarding "load demo data" seeding + Settings "delete all demo data",
 * covering every module that exists today: Contacts (F1), Catalogue (F2),
 * Quotes (F3), Invoices + Payments (F5/F6, Phase 2 · Money In), and now
 * Jobs (F4, Phase 3 · Jobs & Construction Billing — see DEMO_JOBS/
 * seedJobs below). Vendor bills/expenses (Phase 4) still aren't seeded —
 * those modules don't exist yet. Each demo contact gets one
 * contact person, one address, one lead, and one activity, so the contact
 * detail page (persons/addresses tabs, Leads tab, Activities tab) has
 * something real to show rather than a bare shell — matching what a
 * manually-entered contact would look like.
 *
 * Contacts/Catalogue rows are inserted directly rather than calling
 * ContactsService.create/CatalogService.create (which run duplicate-
 * detection and a full read-back this bulk seed doesn't need), but every
 * row still gets the same "created" audit-log entry a real user create
 * would, so History/audit views show these rows honestly as created
 * records, not silently materialized ones. Quotes are the one exception:
 * seeded via the real `QuotesService.create`/`.send`/`.revise` methods (see
 * `seedQuotes` below) rather than hand-inserted, since quote totals/
 * discount-approval gating/gapless numbering are real, non-trivial state-
 * machine logic worth reusing rather than duplicating — a seeded "sent"
 * demo quote gets a genuine `QUO-0001`-style number from the same
 * `NumberingService` a real send would use.
 *
 * `leads`/`activities` have no `isDemo` column of their own — both FK to
 * `contacts.id` with `onDelete: "cascade"`, so deleting a demo contact
 * (deleteAll below) already removes its lead/activity/person/address rows
 * transitively. `quote_lines`/`invoice_lines` are the same story relative
 * to `quotes`/`invoices` (`onDelete: "cascade"`). Only
 * `contacts`/`catalog_items`/`quotes`/`invoices`/`payments` need their own
 * `isDemo` flag since they're the roots being selected for deletion.
 *
 * Invoices and payments follow the exact same "seed via the real service"
 * principle as quotes (see above) — `InvoicesService.create`/`.issue`/
 * `.void` and `PaymentsService.create` are called directly rather than
 * hand-inserting rows, so a seeded "issued" demo invoice has a genuine
 * `INV-0001`-style number and a real §7.2 journal posting, and a seeded
 * "partially paid" demo invoice's `amountPaid`/balance came from an actual
 * allocation, not a hand-set column. See `seedInvoices` below.
 */
@Injectable()
export class DemoDataService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly quotesService: QuotesService,
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly jobsService: JobsService,
    private readonly milestonesService: MilestonesService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Only writes a setting if the org doesn't already have one at that key —
   * a real guard, not a formality: `seed()` is safe to call twice (re-
   * running it only ever adds more demo rows, per this class's own
   * established convention), and a second run must not clobber a business
   * profile the owner has since edited by hand. In practice this only ever
   * fires on a genuinely fresh org, since the only caller of `POST
   * /demo-data/seed` is the onboarding welcome step, which runs before any
   * settings step could have set these — but the guard costs nothing and
   * makes that assumption explicit rather than silently relied on.
   */
  private async seedSettingIfUnset(orgId: string, key: string, value: unknown): Promise<void> {
    const existing = await this.settingsService.get(orgId, key);
    if (existing !== null) return;
    await this.settingsService.set(orgId, key, value);
  }

  async seed(orgId: string, actorUserId: string) {
    await this.seedSettingIfUnset(orgId, "business_profile", DEMO_BUSINESS_PROFILE);
    await this.seedSettingIfUnset(orgId, "industry_template", DEMO_INDUSTRY_TEMPLATE);
    await this.seedSettingIfUnset(orgId, "currency", DEMO_CURRENCY);

    const [currencySetting] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    const currencyCode = (currencySetting?.value as { code?: string } | undefined)?.code ?? "USD";

    const [taxSetting] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "default_tax_rate")));
    const taxRatePercentage = (taxSetting?.value as { percentage?: number } | undefined)?.percentage ?? 0;

    const result = await this.db.transaction(async (tx) => {
      let contactsCreated = 0;
      let personsCreated = 0;
      let addressesCreated = 0;
      let leadsCreated = 0;
      let activitiesCreated = 0;
      // Positional (same order as DEMO_CONTACTS/DEMO_CATALOG_ITEMS) id
      // lists, so seedQuotes below — which must run after this transaction
      // commits, since QuotesService.create/.send/.revise open their own
      // transactions and can't nest inside this one — can resolve each
      // DEMO_QUOTES entry's contactIndex/catalogItemIndex into a real id.
      const contactIds: string[] = [];

      for (const seed of DEMO_CONTACTS) {
        const [contact] = await tx
          .insert(contacts)
          .values({
            orgId,
            type: seed.type,
            isCompany: seed.isCompany,
            name: seed.name,
            email: seed.email,
            phone: seed.phone,
            taxId: seed.taxId ?? null,
            website: seed.website ?? null,
            isDemo: true,
          })
          .returning();
        if (!contact) continue;
        contactsCreated++;
        contactIds.push(contact.id);
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "created",
          entityType: "contact",
          entityId: contact.id,
          contactId: contact.id,
          changes: [{ field: "name", from: null, to: contact.name }],
        });

        const [person] = await tx
          .insert(contactPersons)
          .values({
            contactId: contact.id,
            name: seed.person.name,
            title: seed.person.title,
            email: seed.person.email,
            phone: seed.person.phone,
            isPrimary: true,
          })
          .returning();
        if (person) {
          personsCreated++;
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "contact_person",
            entityId: person.id,
            contactId: contact.id,
            changes: [{ field: "name", from: null, to: person.name }],
          });
        }

        const [address] = await tx
          .insert(addresses)
          .values({
            contactId: contact.id,
            type: "billing",
            line1: seed.address.line1,
            city: seed.address.city,
            state: seed.address.state,
            postalCode: seed.address.postalCode,
            country: seed.address.country,
            isPrimary: true,
          })
          .returning();
        if (address) {
          addressesCreated++;
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "address",
            entityId: address.id,
            contactId: contact.id,
            changes: [{ field: "line1", from: null, to: address.line1 }],
          });
        }

        const [lead] = await tx
          .insert(leads)
          .values({
            orgId,
            contactId: contact.id,
            stage: seed.lead.stage,
            valueAmount: seed.lead.valueAmount,
            valueCurrency: currencyCode,
            source: seed.lead.source,
            title: seed.lead.title,
          })
          .returning();
        if (lead) {
          leadsCreated++;
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "lead",
            entityId: lead.id,
            contactId: contact.id,
            changes: [{ field: "title", from: null, to: lead.title }],
          });
        }

        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + seed.activity.dueInDays);
        const [activity] = await tx
          .insert(activities)
          .values({
            orgId,
            contactId: contact.id,
            leadId: lead?.id ?? null,
            type: seed.activity.type,
            notes: seed.activity.notes,
            dueAt,
            doneAt: seed.activity.dueInDays < 0 ? dueAt : null,
            assignedToUserId: actorUserId,
            createdByUserId: actorUserId,
          })
          .returning();
        if (activity) {
          activitiesCreated++;
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "activity",
            entityId: activity.id,
            contactId: contact.id,
            changes: [{ field: "type", from: null, to: activity.type }],
          });
        }
      }

      const insertedItems = await tx
        .insert(catalogItems)
        .values(
          DEMO_CATALOG_ITEMS.map((item) => ({
            orgId,
            name: item.name,
            description: item.description,
            unit: item.unit,
            category: item.category,
            defaultPriceAmount: item.priceAmount,
            defaultPriceCurrency: currencyCode,
            defaultTaxRatePercentage: taxRatePercentage,
            isDemo: true,
          })),
        )
        .returning();
      for (const item of insertedItems) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "created",
          entityType: "catalog_item",
          entityId: item.id,
          contactId: null,
          changes: [{ field: "name", from: null, to: item.name }],
        });
      }

      // Matched back to DEMO_CATALOG_ITEMS by name (not by array position) —
      // a multi-row INSERT ... RETURNING has no documented guarantee of
      // preserving VALUES-list order in the returned rows, so seedQuotes
      // below (which needs to resolve each DEMO_QUOTES line's
      // catalogItemIndex to the correct real row) can't safely assume
      // insertedItems[i] corresponds to DEMO_CATALOG_ITEMS[i]. Every name in
      // DEMO_CATALOG_ITEMS is unique, so a name lookup is unambiguous.
      const catalogItemIdByName = new Map(insertedItems.map((item) => [item.name, item.id]));
      const catalogItemIds = DEMO_CATALOG_ITEMS.map((item) => catalogItemIdByName.get(item.name)!);

      return {
        contactsCreated,
        contactPersonsCreated: personsCreated,
        addressesCreated,
        leadsCreated,
        activitiesCreated,
        catalogItemsCreated: insertedItems.length,
        contactIds,
        catalogItemIds,
      };
    });

    const quotesResult = await this.seedQuotes(orgId, actorUserId, result.contactIds, result.catalogItemIds);
    const invoicesResult = await this.seedInvoices(orgId, actorUserId, result.contactIds, result.catalogItemIds);
    const jobsResult = await this.seedJobs(orgId, actorUserId, result.contactIds);

    return { ...result, ...quotesResult, ...invoicesResult, ...jobsResult };
  }

  /**
   * Runs AFTER the contacts/catalog-items transaction above commits — each
   * DEMO_QUOTES entry goes through the real `QuotesService.create`/`.send`/
   * `.revise` (see this class's own top comment for why: real totals/
   * discount-approval/numbering logic, not duplicated). Those methods open
   * their own `db.transaction(...)` calls internally, so they cannot be
   * nested inside the seed() transaction above — Drizzle/pg's `Transaction`
   * type from a `db.transaction` callback is not itself re-enterable via a
   * fresh `this.db.transaction(...)` call the way `QuotesService`'s own
   * methods each independently open. Each of the 5 seed quotes is its own
   * unit of work; a failure partway through leaves whichever quotes already
   * succeeded in place rather than rolling back the whole batch — acceptable
   * for demo data (re-running seed is always safe; it only ever adds more
   * rows, and deleteAll cleans up by isDemo flag regardless of how many
   * quotes made it through).
   */
  private async seedQuotes(orgId: string, actorUserId: string, contactIds: string[], catalogItemIds: string[]) {
    let quotesCreated = 0;
    let quotesSent = 0;
    let quotesRevised = 0;

    for (const seed of DEMO_QUOTES) {
      const contactId = contactIds[seed.contactIndex];
      if (!contactId) continue;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + seed.validUntilInDays);

      const lines = seed.lines
        .map((line) => {
          const item = DEMO_CATALOG_ITEMS[line.catalogItemIndex];
          const catalogItemId = catalogItemIds[line.catalogItemIndex];
          if (!item || !catalogItemId) return null;
          return {
            type: "item" as const,
            catalogItemId,
            name: item.name,
            description: item.description,
            quantity: line.quantity,
            unitPriceAmount: item.priceAmount,
            discountPercentage: line.discountPercentage ?? 0,
            taxRatePercentage: 0,
          };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);
      if (!lines.length) continue;

      const [currencySetting] = await this.db
        .select()
        .from(settings)
        .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
      const currencyCode = (currencySetting?.value as { code?: string } | undefined)?.code ?? "USD";

      const quote = await this.quotesService.create(
        orgId,
        actorUserId,
        {
          contactId,
          currency: currencyCode,
          validUntil,
          notes: seed.notes ?? null,
          termsAndConditions: seed.termsAndConditions ?? null,
          lines,
        },
        true, // isDemo
      );
      quotesCreated++;

      if (seed.outcome === "sent" || seed.outcome === "revised") {
        // A quote whose blended discount met the approval threshold can't
        // be sent until approved (S-03.9) — seed data doesn't fabricate a
        // fake approver bypass; it approves through the same
        // approveDiscount() a real owner action would call, so a seeded
        // "sent" demo quote is honestly sendable, not just forced into
        // that status.
        if (quote.discountRequiresApproval) {
          await this.quotesService.approveDiscount(orgId, quote.id, actorUserId);
        }
        await this.quotesService.send(orgId, quote.id, actorUserId);
        quotesSent++;
      }
      if (seed.outcome === "revised") {
        await this.quotesService.revise(orgId, quote.id, actorUserId);
        quotesRevised++;
      }
    }

    return { quotesCreated, quotesSent, quotesRevised };
  }

  /**
   * Same "runs after the transaction above commits, calls the real
   * service" reasoning as `seedQuotes` — `InvoicesService.create`/`.issue`/
   * `.void` and `PaymentsService.create` each open their own transactions.
   * Independent of the seeded quotes (no `sourceQuoteId` wiring — see
   * DEMO_INVOICES' own comment on why).
   */
  private async seedInvoices(orgId: string, actorUserId: string, contactIds: string[], catalogItemIds: string[]) {
    let invoicesCreated = 0;
    let invoicesIssued = 0;
    let invoicesVoided = 0;
    let paymentsCreated = 0;

    const [currencySetting] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    const currencyCode = (currencySetting?.value as { code?: string } | undefined)?.code ?? "USD";

    for (const seed of DEMO_INVOICES) {
      const contactId = contactIds[seed.contactIndex];
      if (!contactId) continue;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + seed.dueInDays);

      const lines = seed.lines
        .map((line) => {
          const item = DEMO_CATALOG_ITEMS[line.catalogItemIndex];
          const catalogItemId = catalogItemIds[line.catalogItemIndex];
          if (!item || !catalogItemId) return null;
          return {
            type: "item" as const,
            catalogItemId,
            name: item.name,
            description: item.description,
            quantity: line.quantity,
            unitPriceAmount: item.priceAmount,
            discountPercentage: 0,
            taxRatePercentage: 0,
          };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);
      if (!lines.length) continue;

      const invoice = await this.invoicesService.create(
        orgId,
        actorUserId,
        {
          contactId,
          type: "standard",
          currency: currencyCode,
          dueDate,
          notes: seed.notes ?? null,
          lines,
        },
        true, // isDemo
      );
      invoicesCreated++;

      if (seed.outcome === "draft") continue;

      const issued = await this.invoicesService.issue(orgId, invoice.id, actorUserId);
      invoicesIssued++;

      if (seed.outcome === "voided") {
        await this.invoicesService.void(orgId, issued.id, actorUserId, "Duplicate billing — corrected invoice raised separately.");
        invoicesVoided++;
        continue;
      }

      if (seed.outcome === "partiallyPaid" || seed.outcome === "paidInFull") {
        const total = BigInt(issued.totalAmount);
        const payAmount = seed.outcome === "paidInFull" ? total : (total * BigInt(Math.round((seed.partialPaymentFraction ?? 0.5) * 100))) / 100n;
        if (payAmount > 0n) {
          await this.paymentsService.create(
            orgId,
            actorUserId,
            {
              contactId,
              date: new Date(),
              method: "bank_transfer",
              reference: null,
              currency: currencyCode,
              amount: payAmount,
              allocations: [{ invoiceId: issued.id, amount: payAmount }],
            },
            undefined, // bankAccountId — default to the seeded "Bank Account"
            true, // isDemo
          );
          paymentsCreated++;
        }
      }
    }

    return { invoicesCreated, invoicesIssued, invoicesVoided, paymentsCreated };
  }

  /**
   * PRD §11.3 — "3 jobs at different stages" + "retention." Same "seed via
   * the real service" principle as `seedQuotes`/`seedInvoices`:
   * `JobsService.create`, `MilestonesService.setAll`/`.completeMilestone`/
   * `.invoiceMilestone`, and `InvoicesService.issue`/`.releaseRetention`
   * are all called directly, never hand-inserted, so a seeded
   * "nearingCompletion" job has genuine `JOB-`-adjacent progress-invoice
   * numbers and real §7.2 retention postings (net-AR + Retention
   * Receivable split) exactly like a real user's clicks would produce.
   *
   * Each `DemoJobSeed.outcome` drives how far through S-04.1→S-04.7 the
   * job is walked: `active` only defines milestones; `inProgress`
   * additionally completes+invoices+issues the first; `nearingCompletion`
   * does the same for the second too; `retentionReleased` walks every
   * milestone through complete→invoice→issue and then calls
   * `InvoicesService.releaseRetention` for the whole held-back amount —
   * the one seeded job that demonstrates the full retention lifecycle
   * end to end.
   */
  private async seedJobs(orgId: string, actorUserId: string, contactIds: string[]) {
    let jobsCreated = 0;
    let milestonesInvoiced = 0;
    let retentionReleases = 0;

    for (const seed of DEMO_JOBS) {
      const contactId = contactIds[seed.contactIndex];
      if (!contactId) continue;

      const [currencySetting] = await this.db
        .select()
        .from(settings)
        .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
      const currencyCode = (currencySetting?.value as { code?: string } | undefined)?.code ?? "USD";

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + seed.startInDays);

      const job = await this.jobsService.create(
        orgId,
        actorUserId,
        {
          contactId,
          name: seed.name,
          siteAddress: seed.siteAddress,
          currency: currencyCode,
          startDate,
          endDate: null,
          contractValueAmount: seed.contractValueAmount,
          retentionPct: seed.retentionPct,
          notes: null,
        },
        true, // isDemo
      );
      jobsCreated++;

      const milestones = await this.milestonesService.setAll(orgId, job.id, actorUserId, {
        milestones: seed.milestones.map((m, i) => {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + m.dueInDays);
          return { name: m.name, sequence: i, amountType: m.amountType, amount: m.amount, dueDate };
        }),
      });

      if (seed.outcome === "active") continue;

      const toAdvance = seed.outcome === "inProgress" ? 1 : 2;
      for (let i = 0; i < Math.min(toAdvance, milestones.length); i++) {
        const milestone = milestones[i]!;
        await this.milestonesService.completeMilestone(orgId, job.id, milestone.id, actorUserId, {
          completionNotes: `${milestone.name} — completed on schedule.`,
          photoFileIds: [],
        });
        const invoice = await this.milestonesService.invoiceMilestone(orgId, job.id, milestone.id, actorUserId);
        await this.invoicesService.issue(orgId, invoice.id, actorUserId);
        milestonesInvoiced++;
      }

      if (seed.outcome === "retentionReleased") {
        for (let i = toAdvance; i < milestones.length; i++) {
          const milestone = milestones[i]!;
          await this.milestonesService.completeMilestone(orgId, job.id, milestone.id, actorUserId, {
            completionNotes: `${milestone.name} — completed on schedule.`,
            photoFileIds: [],
          });
          const invoice = await this.milestonesService.invoiceMilestone(orgId, job.id, milestone.id, actorUserId);
          await this.invoicesService.issue(orgId, invoice.id, actorUserId);
          milestonesInvoiced++;
        }
        await this.invoicesService.releaseRetention(orgId, actorUserId, job.id);
        retentionReleases++;
      }
    }

    return { jobsCreated, milestonesInvoiced, retentionReleases };
  }

  /**
   * Hard-deletes every row tagged `isDemo: true` for this org. Deleting a
   * demo contact cascades onto its contact_persons/addresses/leads/
   * activities automatically (see this class's own top comment on why
   * those tables carry no `isDemo` column of their own); deleting a demo
   * quote/invoice cascades onto its own `quote_lines`/`invoice_lines` the
   * same way.
   *
   * Deletion order matters and is now stricter than it was before Phase 2:
   * **payments, then invoices, then quotes, then contacts, then catalogue
   * items.** `payment_allocations.invoiceId` is `onDelete: "restrict"`
   * (payments.ts's own schema comment), so a demo payment allocated
   * against a demo invoice must go first. `invoices.contactId`/
   * `quotes.contactId` are both `onDelete: "restrict"` too, so both
   * document types must go before their contact.
   *
   * Unlike quotes (which never post to the ledger), a demo invoice that
   * was issued or paid DID post real, immutable `journal_lines` rows
   * (§6.3 — journal entries/lines can never be deleted, only reversed).
   * Deleting the `invoices`/`payments` rows themselves is still fine —
   * `journal_lines`/`journal_entries` reference their source document by
   * `sourceId` alone (a plain uuid column, no FK — see ledger.ts), not the
   * other way around, so removing an invoice doesn't touch its journal
   * history; that history simply becomes a permanent, correctly-labeled
   * record of a demo transaction that happened, exactly as it would for a
   * real one. The one thing this means: a demo CONTACT referenced by that
   * now-permanent journal history (`journal_lines.contact_id`, also
   * `onDelete: "restrict"`) genuinely cannot be hard-deleted afterward —
   * the same "blocked if referenced" check this method already had
   * defensively (for a hypothetical future module) is now a real,
   * expected outcome for any demo contact that had an issued/paid demo
   * invoice: its financial-document rows (invoice, payment) ARE removed,
   * but the contact record itself is left behind, matching exactly how a
   * real contact with real ledger history behaves (ContactsService.delete
   * offers deactivation instead). Since every demo invoice/payment row is
   * itself always removed regardless (only the CONTACT can get stuck),
   * `status()` below checking for a leftover demo contact would report
   * `hasDemoData: true` forever after a single issued/paid demo invoice
   * existed even once — so `status()` deliberately checks demo
   * quotes/invoices/catalog items only, not contacts, matching what a
   * fresh "load demo data" click actually needs to know ("is there a full
   * demo dataset to clear before reseeding", not "is there any leftover
   * row anywhere").
   */
  async deleteAll(orgId: string, actorUserId: string) {
    const demoPayments = await this.db
      .select({ id: payments.id, number: payments.number, contactId: payments.contactId })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), eq(payments.isDemo, true)));
    const demoInvoices = await this.db
      .select({ id: invoices.id, number: invoices.number, contactId: invoices.contactId })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.isDemo, true)));
    const demoQuotes = await this.db
      .select({ id: quotes.id, number: quotes.number, contactId: quotes.contactId })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, true)));
    const demoJobs = await this.db
      .select({ id: jobs.id, name: jobs.name, contactId: jobs.contactId })
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.isDemo, true)));
    const demoContacts = await this.db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true)));
    const demoItems = await this.db
      .select({ id: catalogItems.id, name: catalogItems.name })
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, true)));

    const { paymentsDeleted, invoicesDeleted, quotesDeleted, jobsDeleted, contactsDeleted, catalogItemsDeleted } =
      await this.db.transaction(async (tx) => {
      let paymentsDeleted = 0;
      for (const payment of demoPayments) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "payment",
          entityId: payment.id,
          contactId: payment.contactId,
          changes: [{ field: "number", from: payment.number, to: null }],
        });
        await tx.delete(payments).where(eq(payments.id, payment.id));
        paymentsDeleted++;
      }

      let invoicesDeleted = 0;
      for (const invoice of demoInvoices) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "invoice",
          entityId: invoice.id,
          contactId: invoice.contactId,
          changes: [{ field: "number", from: invoice.number, to: null }],
        });
        await tx.delete(invoices).where(eq(invoices.id, invoice.id));
        invoicesDeleted++;
      }

      let quotesDeleted = 0;
      for (const quote of demoQuotes) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "quote",
          entityId: quote.id,
          contactId: quote.contactId,
          changes: [{ field: "number", from: quote.number, to: null }],
        });
        await tx.delete(quotes).where(eq(quotes.id, quote.id));
        quotesDeleted++;
      }

      // Same "blocked if referenced" pattern as demoContacts below —
      // journal_lines.jobId is onDelete: "restrict" (ledger.ts's own
      // comment), so a job that had ANY progress invoice issued against it
      // (which posts journal_lines with jobId set) can never be
      // hard-deleted, exactly matching how a contact with real ledger
      // history behaves. Every demo job created via seedJobs above except
      // the "active" one (milestones defined, nothing invoiced yet) will
      // hit this and be left in place — cascades onto milestones/
      // job_photos/job_notes/job_variation_orders regardless (all
      // onDelete: "cascade" off jobs.id, per jobs.ts) for the ones that DO
      // get removed.
      let jobsDeleted = 0;
      for (const job of demoJobs) {
        const [referenced] = await tx.select().from(journalLines).where(eq(journalLines.jobId, job.id)).limit(1);
        if (referenced) continue;
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "job",
          entityId: job.id,
          contactId: job.contactId,
          changes: [{ field: "name", from: job.name, to: null }],
        });
        await tx.delete(jobs).where(eq(jobs.id, job.id));
        jobsDeleted++;
      }

      let contactsDeleted = 0;
      for (const contact of demoContacts) {
        const [referenced] = await tx.select().from(journalLines).where(eq(journalLines.contactId, contact.id)).limit(1);
        if (referenced) continue;
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "contact",
          entityId: contact.id,
          contactId: null,
          changes: [{ field: "name", from: contact.name, to: null }],
        });
        await tx.delete(contacts).where(eq(contacts.id, contact.id));
        contactsDeleted++;
      }

      let catalogItemsDeleted = 0;
      for (const item of demoItems) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "deleted",
          entityType: "catalog_item",
          entityId: item.id,
          contactId: null,
          changes: [{ field: "name", from: item.name, to: null }],
        });
        await tx.delete(catalogItems).where(eq(catalogItems.id, item.id));
        catalogItemsDeleted++;
      }

      return { paymentsDeleted, invoicesDeleted, quotesDeleted, jobsDeleted, contactsDeleted, catalogItemsDeleted };
    });

    // Every count here is the actual number of rows removed inside the
    // transaction above, not demoX.length — contacts/jobs can be skipped
    // when referenced by a permanent (onDelete: "restrict") journal_lines
    // row, so length would overcount for those; the rest can't currently
    // diverge but are tracked the same way so this can't silently regress.
    return { contactsDeleted, catalogItemsDeleted, quotesDeleted, invoicesDeleted, paymentsDeleted, jobsDeleted };
  }

  /**
   * See deleteAll's own doc comment on why this deliberately doesn't check
   * for a leftover demo contact — the same reasoning excludes jobs too: a
   * demo job with any issued progress invoice can never be hard-deleted
   * (journal_lines.jobId is onDelete: "restrict"), so checking for one
   * here would report `hasDemoData: true` forever after a single such job
   * ever existed, even right after a successful deleteAll. Checking
   * catalog items/quotes/invoices is sufficient — those three are always
   * fully removable, so their absence already means "nothing left to
   * clear."
   */
  async status(orgId: string) {
    const [demoItem] = await this.db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, true)))
      .limit(1);
    const [demoQuote] = await this.db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, true)))
      .limit(1);
    const [demoInvoice] = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.isDemo, true)))
      .limit(1);
    return { hasDemoData: Boolean(demoItem || demoQuote || demoInvoice) };
  }
}
