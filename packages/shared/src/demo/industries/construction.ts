import type { IndustryPack } from "../scenario.ts";

/**
 * Construction / Contracting, outside the United States (where the demo
 * is Riverstone Builders). Civil and finishing works for offices, a
 * warehouse and a clinic, with retention on jobs. GST: works contract
 * services (SAC 9954) and building materials at 18%.
 */
export const CONSTRUCTION: IndustryPack = {
  industry: "construction",
  label: "General contracting & construction",
  exports: false,
  businessNames: {
    US: "Riverstone Builders",
    IN: "Shilpa Buildcon",
    GB: "Ashdown Building Contractors",
    AU: "Ironbark Constructions",
    NZ: "Kauri Build Group",
    AE: "Al Bina Contracting",
    SA: "Najd Construction",
  },
  inLegalName: "Shilpa Buildcon Private Limited",
  items: [
    { key: "survey", name: "Site survey & structural assessment", description: "Site visit, measurements and a structural condition report.", unit: "each", category: "Consulting", price: 450, service: true, in: { price: 18000, hsnSac: "998331", slab: 18 } },
    { key: "civil", name: "Civil works (labour & supervision)", description: "Skilled masons and helpers with site supervision.", unit: "hour", category: "Labour", price: 65, service: true, in: { price: 350, hsnSac: "995411", slab: 18 } },
    { key: "pm", name: "Project management", description: "Planning, procurement and site coordination.", unit: "hour", category: "Labour", price: 95, service: true, in: { price: 1800, hsnSac: "9983", slab: 18 } },
    { key: "cement", name: "Cement (OPC 53 grade)", description: "50 kg bag, delivered to site.", unit: "bag", category: "Materials", price: 12, in: { price: 410, hsnSac: "2523", slab: 18 } },
    { key: "steel", name: "TMT steel bars (Fe 500D)", description: "Reinforcement bars, cut and bent to schedule.", unit: "kg", category: "Materials", price: 1.2, in: { price: 68, hsnSac: "7214", slab: 18 } },
    { key: "rmc", name: "Ready-mix concrete (M25)", description: "Delivered and pumped.", unit: "cubic metre", category: "Materials", price: 160, in: { price: 5900, hsnSac: "3824", slab: 18 } },
    { key: "tiling", name: "Floor & wall tiling", description: "Laying, grouting and finishing.", unit: "sq m", category: "Finishes", price: 45, service: true, in: { price: 950, hsnSac: "995474", slab: 18 } },
    { key: "painting", name: "Painting (two coats)", description: "Surface preparation, primer and two finish coats.", unit: "sq m", category: "Finishes", price: 12, service: true, in: { price: 220, hsnSac: "995473", slab: 18 } },
    { key: "excavator", name: "Excavator hire with operator", description: "Daily rate, fuel included.", unit: "day", category: "Equipment", price: 420, service: true, in: { price: 14000, hsnSac: "9973", slab: 18 } },
    { key: "cleanup", name: "Debris removal & site cleanup", description: "Skip hire, removal and final clean.", unit: "each", category: "Services", price: 550, service: true, in: { price: 12000, hsnSac: "9994", slab: 18 } },
    // Works on a new home are zero-rated for VAT in the UK.
    { key: "newbuild", name: "New-build home works (stage payment)", description: "Shell and core works on a new dwelling.", unit: "stage", category: "Labour", price: 18000, service: true, roleIn: { GB: "zero" }, in: { price: 450000, hsnSac: "995411", slab: 18 } },
  ],
  leads: {
    anchor: { title: "Office block — structural works", value: 480000, stage: "won", source: "Referral", activity: { type: "meeting", notes: "Agreed the pour schedule for the second floor slab.", dueInDays: 4 } },
    regional: { title: "Warehouse extension", value: 220000, stage: "won", source: "Tender", activity: { type: "call", notes: "Confirmed steel delivery dates with their site lead.", dueInDays: 2 } },
    consumer: { title: "Ground-floor extension", value: 38000, stage: "proposal", source: "Website", activity: { type: "task", notes: "Send revised drawings and the quote.", dueInDays: 3 } },
    consumer_far: { title: "Villa extension", value: 42000, stage: "won", source: "Referral", activity: { type: "note", notes: "Balance due on handover; client happy with finishes.", dueInDays: -3 } },
    institution: { title: "Clinic renovation", value: 150000, stage: "won", source: "Existing customer", activity: { type: "call", notes: "Retention release once the defects period ends.", dueInDays: 6 } },
    sez: { title: "Data hall civil works", value: 95000, stage: "qualified", source: "Trade show", activity: { type: "meeting", notes: "Walk the data hall with their facilities team.", dueInDays: 8 } },
    overseas: { title: "Overseas enquiry", value: 0, stage: "lost", source: "Website", activity: { type: "note", notes: "Out of our area.", dueInDays: -20 } },
  },
  quotes: [
    { slot: "anchor", title: "Car park resurfacing — phase 2", validUntilInDays: 30, notes: "Car park resurfacing and line marking — phase 2.", terms: "30% advance, balance on completion. Prices valid for 30 days.", lines: [["civil", 320], ["rmc", 45], ["cleanup", 1]], outcome: "sent" },
    { slot: "regional", title: "Mezzanine floor", validUntilInDays: 21, notes: "Mezzanine floor — bulk materials pricing.", lines: [["steel", 8000, 30], ["rmc", 60, 30], ["civil", 400]], outcome: "draft" },
    { slot: "institution", title: "Ward refurbishment", validUntilInDays: 14, notes: "Ward refurbishment — tiling and painting.", terms: "Prices valid for 14 days. Work out of hours to keep wards open.", lines: [["tiling", 420], ["painting", 900], ["pm", 40]], outcome: "sent" },
    { slot: "consumer", title: "Ground-floor extension", validUntilInDays: 45, notes: "Ground-floor extension — revised after the site visit; see the latest version.", lines: [["survey", 1], ["civil", 260], ["cement", 120], ["tiling", 40]], outcome: "revised" },
    { slot: "sez", title: "Data hall civil works", validUntilInDays: 10, notes: "Data hall civil works — pending their load drawings.", lines: [["civil", 180], ["excavator", 4]], outcome: "draft" },
  ],
  lostLead: { title: "Cold store extension — tender", value: 180000, lines: [["civil", 300], ["rmc", 40], ["steel", 6000]], note: "Lost to a lower bid, about 8% under ours." },
  bundles: [
    { name: "Bathroom refurbishment", description: "Tiling, painting and the labour to fit them, for one bathroom.", items: [["tiling", 20], ["painting", 40], ["civil", 24]] },
    { name: "Slab pour", description: "Concrete, reinforcement and crew for a 12 m³ slab.", items: [["rmc", 12], ["steel", 900], ["civil", 16]] },
  ],
  invoices: {
    inv01: { notes: "Office block — foundation materials.", lines: [["cement", 600], ["steel", 9000]] },
    inv02: { notes: "Garden wall and paving.", lines: [["civil", 90], ["cement", 40]] },
    inv03: { notes: "Warehouse extension — site preparation.", lines: [["excavator", 6], ["civil", 160], ["cleanup", 1]] },
    inv04: { notes: "Clinic renovation — survey and drawings.", lines: [["survey", 1], ["pm", 30]] },
    inv05: { notes: "Data hall — plinth works.", lines: [["civil", 220], ["rmc", 18]] },
    inv06: { notes: "Office block — slab materials.", lines: [["rmc", 70], ["steel", 6000]] },
    inv07: { notes: "Clinic — tiling (raised against the wrong order).", lines: [["tiling", 180]] },
    inv08: { notes: "Warehouse extension — extra excavation.", lines: [["excavator", 5], ["civil", 120]] },
    inv09: { notes: "Data hall — cable trench works.", lines: [["civil", 140], ["cement", 80]] },
    inv10: { notes: "Office block — painting, first two floors.", lines: [["painting", 1400]] },
    inv11: { notes: "Villa extension — final bill.", lines: [["newbuild", 1], ["tiling", 60]] },
    inv12: { notes: "Bathroom retiling.", lines: [["tiling", 24], ["civil", 16]] },
    inv13: { notes: "Office block — project management, this month.", lines: [["pm", 60], ["cleanup", 1]] },
    inv14: { notes: "Clinic — waiting area finishes.", lines: [["tiling", 120], ["painting", 380]] },
    inv15: { notes: "Office block — façade cleaning (draft until measured).", lines: [["civil", 80], ["cleanup", 1]] },
  },
  jobs: {
    a: { slot: "anchor", name: "Office block — structural works", value: 480000, inValue: 18500000, retentionPct: 5, milestones: [["Foundations", 25], ["Superstructure", 45], ["Finishes & handover", 30]], sac: "995414" },
    b: { slot: "regional", name: "Warehouse extension", value: 220000, inValue: 6800000, retentionPct: 5, milestones: [["Site preparation", 30], ["Steel structure", 40], ["Roofing & handover", 30]], sac: "995413" },
    c: { slot: "institution", name: "Clinic renovation", value: 150000, inValue: 4200000, retentionPct: 10, milestones: [["Strip-out", 25], ["Services & finishes", 50], ["Handover", 25]], sac: "995414" },
    releaseRetention: true,
  },
  variationOrder: { notes: "Extra drainage found on excavation — client asked us to proceed.", lines: [{ name: "Additional storm-water drainage", quantity: 1, price: 6500, service: true, in: { price: 240000, hsnSac: "995411", slab: 18 } }] },
  vendors: {
    supplier: { name: "Apex Building Materials", inName: "Apex Building Materials Pvt Ltd", title: "Sales Manager" },
    supplier_far: { name: "Coastline Steel Works", inName: "Coastline Steel Works Pvt Ltd", title: "Account Manager" },
    local: { name: "Kevin Doyle (masonry subcontractor)", inName: "Ravi Kumar (masonry contractor)", title: "Masonry subcontractor" },
    services: { name: "Ridgeline Plant Hire", inName: "Ridgeline Equipment Rentals Pvt Ltd", title: "Rental Coordinator", type: "both" },
  },
  bills: {
    bill1: { ref: "ABM-20441", lines: [{ name: "Cement (OPC 53) — 400 bags", quantity: 400, price: 9, in: { price: 360, hsnSac: "2523", slab: 18 } }, { name: "TMT steel bars", quantity: 2000, price: 0.95, in: { price: 58, hsnSac: "7214", slab: 18 } }] },
    bill2: { ref: "CSW-5502", lines: [{ name: "TMT steel bars — warehouse", quantity: 6000, price: 0.95, in: { price: 58, hsnSac: "7214", slab: 18 } }] },
    bill3: { ref: "RK-104", lines: [{ name: "Masonry labour — clinic strip-out", quantity: 1, price: 3200, service: true, in: { price: 85000, hsnSac: "995411", slab: 18 } }] },
    bill4: { ref: "RPH-8834", lines: [{ name: "Excavator hire — 6 days", quantity: 6, price: 320, service: true, in: { price: 11000, hsnSac: "9973", slab: 18 } }] },
    bill5: { ref: "ABM-20587", lines: [{ name: "Ready-mix concrete (M25)", quantity: 30, price: 130, in: { price: 5100, hsnSac: "3824", slab: 18 } }] },
    bill6: { ref: "CSW-5611", lines: [{ name: "Structural steel sections", quantity: 3500, price: 1.1, in: { price: 64, hsnSac: "7216", slab: 18 } }] },
  },
  expenses: {
    exp1: { category: "Fuel & freight", amount: 180, inAmount: 6500, description: "Diesel for the site generator", paidBy: "company" },
    exp2: { category: "Site overheads & permits", amount: 650, inAmount: 18000, description: "Building permit fee — warehouse extension", paidBy: "company" },
    exp3: { category: "Plant & equipment hire", amount: 240, inAmount: 7500, description: "Concrete vibrator hire — office block", paidBy: "employee" },
    exp4: { category: "Fuel & freight", amount: 95, inAmount: 2800, description: "Fuel — site visits this week", paidBy: "employee" },
    exp5: { category: "Site overheads & permits", amount: 140, inAmount: 4200, description: "Team lunch after the slab pour", paidBy: "employee" },
  },
  creditNote: { reason: "Project management hours over-billed — corrected after the client's review.", line: 0, quantity: 8 },
  meetings: [
    { title: "Slab pour review — office block", slot: "anchor", startInDays: -3, durationHours: 1, atSite: true, description: "Check cube results before the next pour." },
    { title: "Handover snag list — clinic", slot: "institution", startInDays: -12, durationHours: 2, atSite: true, description: "Walk the clinic with the administrator and agree the snag list." },
    { title: "Progress meeting — warehouse extension", slot: "regional", startInDays: 3, durationHours: 1, atSite: false, description: null },
    { title: "Weekly site planning", slot: null, startInDays: 1, durationHours: 1, atSite: false, description: "Internal — crews and deliveries for next week." },
  ],
};
