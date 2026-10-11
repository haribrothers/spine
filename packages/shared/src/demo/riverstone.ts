import type { DemoPlan, DemoPlanContact, DemoPlanItem, DemoPlanLead, DemoPlanLine } from "./types.ts";

/**
 * US-ONB-09 — Riverstone Builders, the default demo (United States,
 * Construction / Contracting), exactly as it was before demos came in
 * countries and industries (D-192): the same contacts, catalogue,
 * documents and order, so everything built and tested against it keeps
 * working. Its invoices are issued and paid today. D-216 adds what the
 * refined screens show: worked leads, quote titles, sent dates and views,
 * an accepted and a declined quote, job end dates and budgets, bundles.
 */

const contact = (
  key: string,
  type: DemoPlanContact["type"],
  isCompany: boolean,
  name: string,
  email: string,
  phone: string,
  extra: { taxId?: string; website?: string },
  person: DemoPlanContact["person"],
  address: DemoPlanContact["address"],
  lead: { stage: NonNullable<DemoPlanContact["lead"]>["stage"]; value: bigint; title: string; source: string },
  activity: NonNullable<DemoPlanContact["activity"]>,
): DemoPlanContact => ({ key, type, isCompany, name, email, phone, ...extra, person, address, lead: lead, activity });

const CONTACTS: DemoPlanContact[] = [
  contact("harborview", "customer", true, "Harborview Construction Co.", "accounts@harborviewco.example", "+1-555-0101", { taxId: "TX-10045512", website: "https://harborviewco.example" },
    { name: "Alan Reyes", title: "Procurement Manager", email: "alan.reyes@harborviewco.example", phone: "+1-555-0111" },
    { line1: "48 Harbor Way", city: "Portland", state: "ME", postalCode: "04101", country: "US" },
    { stage: "proposal", value: 4850000n, title: "Marina office fit-out", source: "Referral" },
    { type: "call", notes: "Discussed timeline for the marina office fit-out proposal.", dueInDays: 3 }),
  contact("mapleRidge", "customer", true, "Maple Ridge Developments", "billing@mapleridge.example", "+1-555-0102", { website: "https://mapleridge.example" },
    { name: "Sarah Kim", title: "Site Manager", email: "sarah.kim@mapleridge.example", phone: "+1-555-0112" },
    { line1: "220 Ridge Rd", city: "Burlington", state: "VT", postalCode: "05401", country: "US" },
    { stage: "qualified", value: 1250000n, title: "Phase 2 townhomes", source: "Website" },
    { type: "meeting", notes: "Site walkthrough for Phase 2 townhome foundations.", dueInDays: 5 }),
  contact("priya", "customer", false, "Priya Nair", "priya.nair@example.com", "+1-555-0103", {},
    { name: "Priya Nair", title: "Homeowner", email: "priya.nair@example.com", phone: "+1-555-0103" },
    { line1: "12 Willow St", city: "Concord", state: "NH", postalCode: "03301", country: "US" },
    { stage: "won", value: 38000n, title: "Kitchen renovation", source: "Referral" },
    { type: "task", notes: "Send final invoice for kitchen renovation.", dueInDays: -2 }),
  contact("sunstone", "customer", true, "Sunstone Retail Fitouts", "ap@sunstoneretail.example", "+1-555-0104", { taxId: "TX-88213340" },
    { name: "Marcus Ellison", title: "Store Ops Director", email: "marcus.ellison@sunstoneretail.example", phone: "+1-555-0113" },
    { line1: "900 Commerce Blvd", city: "Nashua", state: "NH", postalCode: "03060", country: "US" },
    { stage: "new", value: 620000n, title: "Storefront remodel — 3 locations", source: "Trade show" },
    { type: "note", notes: "Requested a rough budget range before scheduling a site visit.", dueInDays: 7 }),
  contact("davidChen", "customer", false, "David Chen", "david.chen@example.com", "+1-555-0105", {},
    { name: "David Chen", title: "Homeowner", email: "david.chen@example.com", phone: "+1-555-0105" },
    { line1: "77 Birchwood Ave", city: "Manchester", state: "NH", postalCode: "03101", country: "US" },
    { stage: "lost", value: 15500n, title: "Deck rebuild", source: "Website" },
    { type: "note", notes: "Went with another contractor — budget mismatch.", dueInDays: -10 }),
  contact("ironclad", "customer", true, "Ironclad Fabrication Ltd.", "orders@ironcladfab.example", "+1-555-0106", { taxId: "TX-55190021", website: "https://ironcladfab.example" },
    { name: "Teresa Lopez", title: "Purchasing Lead", email: "teresa.lopez@ironcladfab.example", phone: "+1-555-0114" },
    { line1: "14 Foundry Ln", city: "Worcester", state: "MA", postalCode: "01608", country: "US" },
    { stage: "proposal", value: 980000n, title: "Structural steel supply contract", source: "Cold outreach" },
    { type: "call", notes: "Walked through steel spec sheet and delivery schedule.", dueInDays: 2 }),
  contact("bluewater", "customer", true, "Bluewater Hospitality Group", "procurement@bluewaterhg.example", "+1-555-0107", {},
    { name: "Nathan Brooks", title: "Facilities Manager", email: "nathan.brooks@bluewaterhg.example", phone: "+1-555-0115" },
    { line1: "5 Waterfront Plz", city: "Providence", state: "RI", postalCode: "02903", country: "US" },
    { stage: "qualified", value: 2100000n, title: "Hotel lobby renovation", source: "Referral" },
    { type: "meeting", notes: "Presented mood boards and material options for the lobby.", dueInDays: 6 }),
  contact("apexTimber", "vendor", true, "Apex Timber Supply", "sales@apextimber.example", "+1-555-0201", { taxId: "TX-30012234" },
    { name: "Greg Foster", title: "Account Rep", email: "greg.foster@apextimber.example", phone: "+1-555-0211" },
    { line1: "600 Mill Rd", city: "Bangor", state: "ME", postalCode: "04401", country: "US" },
    { stage: "won", value: 0n, title: "Preferred lumber supplier agreement", source: "Existing relationship" },
    { type: "call", notes: "Confirmed Q3 pricing for framing lumber.", dueInDays: 14 }),
  contact("graniteState", "vendor", true, "Granite State Concrete", "orders@granitestateconcrete.example", "+1-555-0202", {},
    { name: "Linda Park", title: "Dispatch Coordinator", email: "linda.park@granitestateconcrete.example", phone: "+1-555-0212" },
    { line1: "88 Quarry Rd", city: "Concord", state: "NH", postalCode: "03301", country: "US" },
    { stage: "won", value: 0n, title: "Standing ready-mix delivery order", source: "Existing relationship" },
    { type: "note", notes: "Confirmed delivery slot for next pour.", dueInDays: 4 }),
  contact("northline", "vendor", true, "Northline Electrical Wholesale", "sales@northlineelectrical.example", "+1-555-0203", { website: "https://northlineelectrical.example" },
    { name: "Omar Haddad", title: "Sales Rep", email: "omar.haddad@northlineelectrical.example", phone: "+1-555-0213" },
    { line1: "301 Industrial Pkwy", city: "Lowell", state: "MA", postalCode: "01852", country: "US" },
    { stage: "qualified", value: 42000n, title: "Panel + conduit bulk order", source: "Cold outreach" },
    { type: "task", notes: "Follow up on bulk conduit pricing quote.", dueInDays: 3 }),
  contact("coastalSteel", "vendor", true, "Coastal Steel & Metal Works", "sales@coastalsteel.example", "+1-555-0204", { taxId: "TX-71230098" },
    { name: "Jenna Ortiz", title: "Sales Manager", email: "jenna.ortiz@coastalsteel.example", phone: "+1-555-0214" },
    { line1: "19 Shipyard Dr", city: "New Bedford", state: "MA", postalCode: "02740", country: "US" },
    { stage: "new", value: 76000n, title: "Custom railing fabrication", source: "Website" },
    { type: "call", notes: "Requested drawings for custom railing spec.", dueInDays: 5 }),
  contact("marcusWebb", "vendor", false, "Marcus Webb (Freelance Surveyor)", "marcus.webb@example.com", "+1-555-0205", {},
    { name: "Marcus Webb", title: "Land Surveyor", email: "marcus.webb@example.com", phone: "+1-555-0205" },
    { line1: "9 Meridian Ct", city: "Keene", state: "NH", postalCode: "03431", country: "US" },
    { stage: "won", value: 4200n, title: "Boundary survey — Maple Ridge site", source: "Referral" },
    { type: "note", notes: "Survey report delivered, filed with permit application.", dueInDays: -5 }),
  contact("ridgeline", "both", true, "Ridgeline Equipment Rental", "info@ridgelineequip.example", "+1-555-0301", { website: "https://ridgelineequip.example" },
    { name: "Chris Dalton", title: "Rental Coordinator", email: "chris.dalton@ridgelineequip.example", phone: "+1-555-0311" },
    { line1: "410 Depot St", city: "Springfield", state: "MA", postalCode: "01103", country: "US" },
    { stage: "qualified", value: 18500n, title: "Monthly excavator rental", source: "Existing relationship" },
    { type: "task", notes: "Renew equipment rental agreement before month-end.", dueInDays: 9 }),
  contact("summitGlass", "both", true, "Summit Glass & Glazing", "hello@summitglazing.example", "+1-555-0302", { taxId: "TX-62047781" },
    { name: "Elena Rossi", title: "Estimator", email: "elena.rossi@summitglazing.example", phone: "+1-555-0312" },
    { line1: "77 Summit Ave", city: "Hartford", state: "CT", postalCode: "06103", country: "US" },
    { stage: "proposal", value: 310000n, title: "Curtain wall glazing subcontract", source: "Trade show" },
    { type: "meeting", notes: "Reviewed glazing subcontract scope and pricing.", dueInDays: 4 }),
];

/**
 * US-ONB-24 (D-216) — how each lead is being worked: open leads shared
 * between the owner and the demo Staff person, at different ages, with
 * expected close dates; one gone cold; the lost one with its reason.
 */
const WORKED: Record<string, Partial<DemoPlanLead>> = {
  harborview: { owner: "staff", daysInStage: 18, expectedCloseInDays: 12 },
  mapleRidge: { owner: "owner", daysInStage: 10, expectedCloseInDays: 30 },
  priya: { owner: "owner", daysInStage: 6 },
  sunstone: { owner: "staff", daysInStage: 3, expectedCloseInDays: 50 },
  davidChen: { owner: "owner", daysInStage: 21, lostReason: "price", lostNote: "Went with another contractor — budget mismatch." },
  ironclad: { owner: "owner", daysInStage: 24, expectedCloseInDays: 20 },
  bluewater: { owner: "staff", daysInStage: 12, expectedCloseInDays: 25 },
  apexTimber: { owner: "owner", daysInStage: 120 },
  graniteState: { owner: "owner", daysInStage: 200 },
  northline: { owner: "owner", daysInStage: 8, expectedCloseInDays: 40 },
  coastalSteel: { owner: "staff", daysInStage: 5, expectedCloseInDays: 55 },
  marcusWebb: { owner: "owner", daysInStage: 45 },
  ridgeline: { owner: "owner", daysInStage: 14, expectedCloseInDays: 21 },
  summitGlass: { owner: "staff", daysInStage: 19, expectedCloseInDays: 9, cold: true },
};

const SALES_TAX = { intra: { rate: "Sales Tax" } };
// US-ONB-27: materials post to 4000 Sales — Goods.
const item = (key: string, name: string, description: string, unit: string, category: string, price: bigint): DemoPlanItem => ({ key, name, description, unit, category, price, tax: SALES_TAX, income: category === "Materials" ? "goods" : "services" });

const ITEMS: DemoPlanItem[] = [
  item("survey", "Site survey & assessment", "Initial site visit, measurements, and feasibility notes.", "each", "Consulting", 25000n),
  item("labour", "General labour", "Skilled labour, billed hourly.", "hour", "Labour", 6500n),
  item("pm", "Project management", "On-site and remote project coordination.", "hour", "Labour", 9500n),
  item("lumber", "Framing lumber (2x4x8)", "Kiln-dried SPF framing stud.", "each", "Materials", 850n),
  item("concrete", "Ready-mix concrete", "Standard-strength ready-mix, delivered.", "cubic yard", "Materials", 18000n),
  item("steel", "Structural steel beam", "Fabricated to spec, per linear foot.", "linear ft", "Materials", 4200n),
  item("electrical", "Electrical rough-in", "Rough wiring for a standard room.", "room", "Electrical", 45000n),
  item("plumbing", "Plumbing fixture installation", "Supply and install a standard fixture.", "each", "Plumbing", 32000n),
  item("drywall", "Drywall installation & finishing", "Hang, tape, and finish to level 4.", "sq ft", "Interior", 350n),
  item("painting", "Interior painting", "Two-coat interior paint, walls and trim.", "sq ft", "Interior", 250n),
  item("flooring", "Flooring installation (LVP)", "Supply and install luxury vinyl plank.", "sq ft", "Interior", 600n),
  item("windows", "Window installation", "Standard vinyl window, supply and install.", "each", "Exterior", 65000n),
  item("roofing", "Roofing (asphalt shingle)", "Tear-off and reroof with architectural shingle.", "square", "Exterior", 42000n),
  item("excavator", "Equipment rental — mini excavator", "Daily rental rate.", "day", "Equipment", 35000n),
  item("cleanup", "Waste disposal & site cleanup", "Dumpster rental and final site cleanup.", "each", "Services", 55000n),
];

const l = (key: string, quantity: number, discount?: number): DemoPlanLine => ({ item: key, quantity, ...(discount ? { discount } : {}) });

export function riverstonePlan(): DemoPlan {
  return {
    country: "US",
    industry: "construction",
    business: { name: "Riverstone Builders", address: "220 Timberline Ave, Suite 4, Burlington, VT 05401", industry: "General contracting & construction" },
    currency: { code: "USD", locale: "en-US" },
    financialYearStart: { month: 1, day: 1 },
    template: "construction",
    taxCountry: "other",
    ownTaxRates: [
      { name: "Sales Tax", rate: 15, useDefaultRate: true },
      { name: "State Surcharge", rate: 2.5, isCompound: true },
    ],
    ownTaxGroups: [{ name: "Sales Tax + Surcharge", rates: ["Sales Tax", "State Surcharge"] }],
    ordering: "declared",
    contacts: CONTACTS.map((c) => (c.lead ? { ...c, lead: { ...c.lead, ...WORKED[c.key] } } : c)),
    items: ITEMS,
    quotes: [
      { contact: "harborview", title: "Marina office fit-out — phase 1", outcome: "sent", sentInDays: -40, views: { count: 2, lastInDays: -31 }, validUntilInDays: -5, notes: "Marina office fit-out — phase 1 scope as discussed on site.", terms: "50% deposit on acceptance, balance on completion. Prices valid for 30 days.", lines: [l("survey", 1), l("labour", 80), l("drywall", 600), l("painting", 600)] },
      // Discounted on both material lines so the blended discount clears the 20% approval threshold: left unapproved, unsent.
      { contact: "mapleRidge", title: "Phase 2 townhomes — foundations", validUntilInDays: 21, notes: "Phase 2 townhome foundations — bulk materials pricing applied.", lines: [l("concrete", 40, 32), l("steel", 200, 32), l("labour", 120)], outcome: "draft" },
      { contact: "sunstone", title: "Storefront remodel — location 1", sentInDays: -18, views: { count: 3, lastInDays: -2 }, validUntilInDays: 5, notes: "Storefront remodel — location 1 of 3, remaining locations to follow as separate quotes.", terms: "Prices valid for 14 days. Scheduling subject to permit approval.", lines: [l("survey", 1), l("pm", 24), l("windows", 6), l("flooring", 900)], outcome: "sent" },
      { contact: "bluewater", title: "Hotel lobby renovation", sentInDays: -30, revisedInDays: -9, views: { count: 1, lastInDays: -26 }, validUntilInDays: 45, notes: "Hotel lobby renovation — revised scope after design review, see v2 for current pricing.", terms: "50% deposit on acceptance. Prices valid for 45 days.", lines: [l("pm", 60), l("painting", 1400), l("flooring", 1200)], outcome: "revised" },
      { contact: "summitGlass", title: "Curtain wall glazing", validUntilInDays: 10, notes: "Curtain wall glazing subcontract — draft pending final measurements.", lines: [l("electrical", 3), l("labour", 40)], outcome: "draft" },
      // US-ONB-25: accepted this month (the won lead) and declined (the lost lead).
      { contact: "priya", title: "Kitchen renovation", validUntilInDays: 20, notes: "Kitchen renovation — labour, flooring and paint.", lines: [l("labour", 60), l("flooring", 220), l("painting", 350)], outcome: "accepted", sentInDays: -20, views: { count: 2, lastInDays: -18 }, respondedInDays: -1, thisMonth: true, comment: "Looks great — go ahead." },
      { contact: "davidChen", title: "Deck rebuild", validUntilInDays: -5, notes: "Deck rebuild — framing, labour and cleanup.", lines: [l("lumber", 120), l("labour", 24), l("cleanup", 1)], outcome: "declined", sentInDays: -35, views: { count: 2, lastInDays: -28 }, respondedInDays: -21, comment: "Thanks, but we've gone with a cheaper quote." },
    ],
    invoices: [
      { key: "kitchen", contact: "priya", issueInDays: null, dueInDays: -12, notes: "Kitchen renovation — final invoice.", lines: [l("labour", 60), l("flooring", 220), l("painting", 350)], outcome: "issued", payments: [{ inDays: null, amount: "full" }] },
      { key: "marinaProgress", contact: "harborview", issueInDays: null, dueInDays: -5, notes: "Marina office fit-out — progress bill 1 of 3.", lines: [l("labour", 100), l("drywall", 400)], outcome: "issued", payments: [{ inDays: null, amount: 0.5 }], emailedInDays: null, remindedInDays: null },
      { key: "lobbyDeposit", contact: "bluewater", issueInDays: null, dueInDays: 5, notes: "Hotel lobby renovation — deposit invoice.", lines: [l("pm", 20)], outcome: "issued", emailedInDays: null },
      { key: "storefront", contact: "sunstone", issueInDays: null, dueInDays: 30, notes: "Storefront remodel — location 1, draft pending final measurements.", lines: [l("windows", 4), l("cleanup", 1)], outcome: "draft" },
      { key: "duplicate", contact: "ridgeline", issueInDays: null, dueInDays: 15, notes: "Duplicate billing — voided, corrected invoice raised separately.", lines: [l("excavator", 5)], outcome: "voided", voidReason: "Duplicate billing — corrected invoice raised separately." },
    ],
    jobs: [
      { key: "marina", contact: "harborview", name: "Marina office fit-out", siteAddress: "48 Harbor Way, Portland, ME 04101", contractValue: 4850000n, retentionPct: 5, startInDays: -14,
        milestones: [
          { name: "Mobilisation & site setup", amountType: "percent", amount: 20, dueInDays: 7 },
          { name: "Framing & rough-in complete", amountType: "percent", amount: 40, dueInDays: 30 },
          { name: "Final fit-out & handover", amountType: "percent", amount: 40, dueInDays: 60 },
        ],
        endInDays: 75, budget: "near", fromQuote: { title: "Marina office fit-out", sentInDays: -18, viewedInDays: -17, respondedInDays: -16 },
        note: "Site kicked off — 48 Harbor Way, Portland, ME 04101. Crew scheduled per the milestone plan below.", photoCaption: "Site condition at kickoff." },
      { key: "townhomes", contact: "mapleRidge", name: "Phase 2 townhomes — foundations", siteAddress: "220 Ridge Rd, Burlington, VT 05401", contractValue: 1250000n, retentionPct: 10, startInDays: -45,
        milestones: [
          { name: "Excavation & footings", amountType: "percent", amount: 35, dueInDays: -20, invoiceInDays: null },
          // US-ONB-26: done today and waiting to be invoiced.
          { name: "Foundation walls poured", amountType: "percent", amount: 35, dueInDays: 10, completeInDays: null },
          { name: "Backfill & inspection sign-off", amountType: "percent", amount: 30, dueInDays: 25 },
        ],
        endInDays: 40, budget: 0.75, percentComplete: 60,
        note: "Site kicked off — 220 Ridge Rd, Burlington, VT 05401. Crew scheduled per the milestone plan below.", photoCaption: "Site condition at kickoff." },
      { key: "lobby", contact: "bluewater", name: "Hotel lobby renovation", siteAddress: "5 Waterfront Plz, Providence, RI 02903", contractValue: 2100000n, retentionPct: 8, startInDays: -120,
        milestones: [
          { name: "Demolition & prep", amountType: "percent", amount: 25, dueInDays: -100, invoiceInDays: null },
          { name: "Millwork & finishes installed", amountType: "percent", amount: 50, dueInDays: -60, invoiceInDays: null },
          { name: "Final walkthrough & sign-off", amountType: "percent", amount: 25, dueInDays: -30, invoiceInDays: null },
        ],
        releaseRetention: true,
        endInDays: -25, budget: 0.7, completed: true,
        note: "Site kicked off — 5 Waterfront Plz, Providence, RI 02903. Crew scheduled per the milestone plan below.", photoCaption: "Site condition at kickoff." },
    ],
    variationOrder: { job: "marina", notes: "Additional scope requested on site — see attached line items.", lines: [{ name: "Additional electrical outlets (site-requested)", quantity: 6, price: 8500n, tax: null }] },
    bills: [
      { contact: "apexTimber", billNumber: "AT-20441", dateInDays: -10, dueInDays: 20, lines: [{ name: "Framing lumber delivery", quantity: 500, price: 850n, tax: null }], outcome: "recorded", job: "marina", payments: [{ inDays: null }] },
      { contact: "graniteState", billNumber: "GSC-8834", dateInDays: -35, dueInDays: -5, lines: [{ name: "Ready-mix concrete pour", quantity: 12, price: 18000n, tax: null }], outcome: "recorded" },
      { contact: "coastalSteel", billNumber: "CSM-5502", dateInDays: -3, dueInDays: 27, lines: [{ name: "Structural steel beams", quantity: 80, price: 4200n, tax: null }], outcome: "draft" },
      { contact: "northline", billNumber: "NEW-1190", dateInDays: -50, dueInDays: -20, lines: [{ name: "Electrical rough-in materials", quantity: 3, price: 45000n, tax: null }], outcome: "voided", voidReason: "Duplicate bill entered in error" },
    ],
    expenses: [
      { category: "Fuel & freight", amount: 8500n, paidBy: "employee", description: "Site visits — Marina office fit-out", dateInDays: -6, outcome: "approved", job: "marina" },
      { category: "Site overheads & permits", amount: 4200n, paidBy: "employee", description: "Crew lunch — foundation pour day", dateInDays: -12, outcome: "approved" },
      { category: "Plant & equipment hire", amount: 15000n, paidBy: "company", description: "Replacement power tools", dateInDays: -20, outcome: "approved" },
      { category: "Fuel & freight", amount: 6000n, paidBy: "employee", description: "Fuel — no receipt attached", dateInDays: -2, outcome: "submitted" },
      { category: "Site overheads & permits", amount: 12000n, paidBy: "employee", description: "Client lunch (over policy limit)", dateInDays: -8, outcome: "rejected", rejectReason: "Over the org's per-meal policy limit — please resubmit with an itemised receipt." },
    ],
    // US-ONB-29: off its invoice; on the paid kitchen invoice, credit kept for the customer; and credit refunded.
    creditNotes: [
      { invoice: "lobbyDeposit", reason: "Overbilled hours — corrected per client review.", lines: [{ line: 0, quantity: 4 }] },
      { invoice: "kitchen", reason: "Six labour hours not worked — credit kept for the next job.", lines: [{ line: 0, quantity: 6 }] },
      { invoice: "kitchen", reason: "Paint touch-up not needed — refunded.", lines: [{ line: 2, quantity: 20 }], refundInDays: null },
    ],
    meetings: [
      { title: "Site walkthrough — Marina office fit-out", contact: "harborview", startInDays: -3, startTime: "10:00", durationHours: 1, location: "48 Harbor Way, Portland, ME 04101", description: "Walk the space with the client before framing sign-off." },
      { title: "Kickoff call — kitchen renovation scope", contact: "priya", startInDays: -10, startTime: "15:30", durationHours: 1, location: null, description: "Confirm final material selections and schedule." },
      { title: "Progress review — Phase 2 townhomes", contact: "mapleRidge", startInDays: 3, startTime: "11:00", durationHours: 2, location: "220 Ridge Rd, Burlington, VT 05401", description: null },
      { title: "Weekly crew scheduling", contact: null, startInDays: 1, startTime: "08:30", durationHours: 1, location: null, description: "Internal — assign crews to next week's jobs." },
      { title: "Glazing scope review — Summit Glass", contact: "summitGlass", startInDays: 8, startTime: "14:00", durationHours: 1, location: null, description: "Agree the curtain wall scope before we finalise the quote." },
    ],
    bundles: [
      { name: "Room refresh", description: "Drywall, two-coat paint and labour for one room.", items: [["drywall", 400], ["painting", 400], ["labour", 16]] },
      { name: "Kitchen fit-out", description: "Two fixtures, an electrical rough-in and LVP flooring for a standard kitchen.", items: [["plumbing", 2], ["electrical", 1], ["flooring", 220]] },
    ],
  };
}
