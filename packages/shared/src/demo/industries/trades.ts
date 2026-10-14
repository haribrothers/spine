import type { IndustryPack } from "../scenario.ts";

/**
 * Trades (electrical, plumbing, HVAC): call-outs, installations, a
 * maintenance contract and three installation jobs, crewed from the field
 * app. GST: installation services (SAC 995461–995463), repairs (9987),
 * air conditioners (HSN 8415, 18% since 22 September 2025), cables and
 * switchgear at 18%. In the UK, mobility aids fitted for an older person
 * are at the 5% reduced rate.
 */
export const TRADES: IndustryPack = {
  industry: "trades",
  label: "Electrical, plumbing & HVAC",
  exports: false,
  businessNames: {
    US: "BrightLine Electric & Air",
    IN: "Kaveri Electro-Mech Services",
    GB: "Brook & Sons Electrical",
    AU: "Southern Cross Electrical",
    NZ: "Ruapehu Plumbing & Electrical",
    AE: "Al Barq Technical Services",
    SA: "Al Hadi Electromechanical",
  },
  inLegalName: "Kaveri Electro-Mech Services Private Limited",
  items: [
    { key: "callout", name: "Call-out & diagnosis", description: "First hour on site, travel included.", unit: "each", category: "Service", price: 95, service: true, in: { price: 500, hsnSac: "9987", slab: 18 } },
    { key: "electrician", name: "Electrician", description: "Licensed electrician, billed hourly.", unit: "hour", category: "Labour", price: 85, service: true, in: { price: 450, hsnSac: "995461", slab: 18 } },
    { key: "plumber", name: "Plumber", description: "Licensed plumber, billed hourly.", unit: "hour", category: "Labour", price: 80, service: true, in: { price: 400, hsnSac: "995462", slab: 18 } },
    { key: "acinstall", name: "Split AC installation", description: "Mounting, piping up to 3 m, vacuum and commissioning.", unit: "each", category: "HVAC", price: 350, service: true, in: { price: 2500, hsnSac: "995463", slab: 18 } },
    { key: "acunit", name: "Split air conditioner 1.5 ton (inverter)", description: "5-star inverter unit with warranty.", unit: "each", category: "HVAC", price: 900, in: { price: 42000, hsnSac: "8415", slab: 18 } },
    { key: "rewire", name: "Rewiring (per room)", description: "New wiring, switches and sockets for one room.", unit: "room", category: "Electrical", price: 650, service: true, in: { price: 9500, hsnSac: "995461", slab: 18 } },
    { key: "dbboard", name: "Distribution board (8-way)", description: "With MCBs and RCCB, supplied and fitted.", unit: "each", category: "Electrical", price: 240, in: { price: 6800, hsnSac: "8537", slab: 18 } },
    { key: "cable", name: "Copper cable 2.5 sq mm", description: "FR-LSH house wire.", unit: "metre", category: "Electrical", price: 1.1, in: { price: 38, hsnSac: "8544", slab: 18 } },
    { key: "pipes", name: "CPVC pipes & fittings", description: "Hot and cold water lines.", unit: "metre", category: "Plumbing", price: 6, in: { price: 180, hsnSac: "3917", slab: 18 } },
    { key: "amc", name: "Annual maintenance contract (HVAC)", description: "Quarterly servicing of up to 20 units, priority call-outs.", unit: "year", category: "Service", price: 1800, service: true, in: { price: 48000, hsnSac: "9987", slab: 18 } },
    { key: "mobility", name: "Grab rails & mobility aids fitted", description: "Supplied and fitted for an older person at home.", unit: "each", category: "Service", price: 240, roleIn: { GB: "reduced" }, in: { price: 3500, hsnSac: "9987", slab: 18 } },
  ],
  leads: {
    anchor: { title: "HVAC retrofit — office tower", value: 95000, stage: "won", source: "Referral", activity: { type: "meeting", notes: "Plan the weekend shutdown for the ducting works.", dueInDays: 4 } },
    regional: { title: "Factory electrical upgrade", value: 60000, stage: "won", source: "Tender", activity: { type: "call", notes: "Confirmed the panel delivery date.", dueInDays: 2 } },
    consumer: { title: "Full-house rewiring", value: 5200, stage: "proposal", source: "Google", activity: { type: "task", notes: "Send the quote for three bedrooms.", dueInDays: 1 } },
    consumer_far: { title: "AC units for a holiday home", value: 4300, stage: "won", source: "Referral", activity: { type: "note", notes: "Installed; client paying the balance next week.", dueInDays: -2 } },
    institution: { title: "School plumbing overhaul", value: 38000, stage: "won", source: "Tender", activity: { type: "call", notes: "Work only in the school holidays.", dueInDays: 6 } },
    sez: { title: "Server room cooling", value: 22000, stage: "qualified", source: "Website", activity: { type: "meeting", notes: "Heat-load survey of the server room.", dueInDays: 8 } },
    overseas: { title: "Overseas enquiry", value: 0, stage: "lost", source: "Website", activity: { type: "note", notes: "Outside our service area.", dueInDays: -30 } },
  },
  quotes: [
    { slot: "anchor", title: "Maintenance contract renewal", validUntilInDays: 30, notes: "Annual maintenance contract — renewal.", terms: "Billed yearly in advance. Valid for 30 days.", lines: [["amc", 1], ["callout", 4]], outcome: "sent" },
    { slot: "regional", title: "Second production line", validUntilInDays: 21, notes: "Second production line — bulk pricing on cable and boards.", lines: [["cable", 2500, 30], ["dbboard", 12, 30], ["electrician", 120]], outcome: "draft" },
    { slot: "institution", title: "Science block hot water", validUntilInDays: 14, notes: "Science block — replace hot water lines.", terms: "Work during the school holidays.", lines: [["pipes", 260], ["plumber", 60]], outcome: "sent" },
    { slot: "consumer", title: "House rewiring", validUntilInDays: 45, notes: "House rewiring — revised to add the kitchen; see the latest version.", lines: [["rewire", 4], ["dbboard", 1], ["callout", 1]], outcome: "revised" },
    { slot: "sez", title: "Server room cooling", validUntilInDays: 10, notes: "Server room cooling — pending the heat-load survey.", lines: [["acunit", 4], ["acinstall", 4]], outcome: "draft" },
  ],
  lostLead: { title: "Second factory rewire — tender", value: 45000, lines: [["rewire", 30], ["dbboard", 4], ["cable", 800]], note: "Another contractor quoted lower." },
  bundles: [
    { name: "Split AC fitted", description: "An inverter split AC, installed, with the first call-out.", items: [["acunit", 1], ["acinstall", 1], ["callout", 1]] },
    { name: "Room rewire", description: "Rewiring one room with cable and an electrician's time.", items: [["rewire", 1], ["cable", 50], ["electrician", 4]] },
  ],
  invoices: {
    inv01: { notes: "Office tower — AC servicing, first quarter.", lines: [["amc", 1]] },
    inv02: { notes: "Leaking geyser line fixed.", lines: [["callout", 1], ["plumber", 2], ["pipes", 6]] },
    inv03: { notes: "Factory — panel survey and cable laying.", lines: [["electrician", 80], ["cable", 1200]] },
    inv04: { notes: "School — washroom repairs.", lines: [["plumber", 24], ["pipes", 40]] },
    inv05: { notes: "Server room — temporary cooling.", lines: [["acunit", 2], ["acinstall", 2]] },
    inv06: { notes: "Office tower — distribution boards replaced.", lines: [["dbboard", 6], ["electrician", 30]] },
    inv07: { notes: "School — lighting circuits (raised against the wrong order).", lines: [["electrician", 18]] },
    inv08: { notes: "Factory — earthing and testing.", lines: [["electrician", 40], ["callout", 2]] },
    inv09: { notes: "Server room — precision AC wiring.", lines: [["electrician", 24], ["cable", 300], ["dbboard", 2]] },
    inv10: { notes: "Office tower — emergency call-outs.", lines: [["callout", 5], ["electrician", 10]] },
    inv11: { notes: "Holiday home — three AC units installed.", lines: [["acunit", 3], ["acinstall", 3]] },
    inv12: { notes: "Bathroom fittings and grab rails.", lines: [["plumber", 4], ["mobility", 2]] },
    inv13: { notes: "Office tower — electrician hours, this month.", lines: [["electrician", 36], ["cable", 200]] },
    inv14: { notes: "School — drinking water line.", lines: [["pipes", 80], ["plumber", 16]] },
    inv15: { notes: "Office tower — UPS room wiring (draft until tested).", lines: [["electrician", 20], ["dbboard", 1]] },
  },
  jobs: {
    a: { slot: "anchor", name: "HVAC retrofit — office tower", value: 95000, inValue: 3400000, retentionPct: 0, milestones: [["Survey & design", 20], ["Ducting & units", 50], ["Commissioning", 30]], sac: "995463" },
    b: { slot: "regional", name: "Factory electrical upgrade", value: 60000, inValue: 2200000, retentionPct: 0, milestones: [["Panels installed", 40], ["Cabling", 40], ["Testing & handover", 20]], sac: "995461" },
    c: { slot: "institution", name: "School plumbing overhaul", value: 38000, inValue: 1250000, retentionPct: 0, milestones: [["Strip-out", 30], ["New lines", 40], ["Pressure testing & handover", 30]], sac: "995462" },
    releaseRetention: false,
  },
  variationOrder: { notes: "Client asked us to move two outdoor units to the roof.", lines: [{ name: "Outdoor unit relocation to roof", quantity: 2, price: 600, service: true, in: { price: 19000, hsnSac: "995463", slab: 18 } }] },
  vendors: {
    supplier: { name: "Northline Electrical Wholesale", inName: "Northline Electricals Pvt Ltd", title: "Sales Rep" },
    supplier_far: { name: "CoolAir Distributors", inName: "CoolAir Distributors Pvt Ltd", title: "Channel Manager" },
    local: { name: "Mick Ryan (plumbing subcontractor)", inName: "Mohammed Ali (plumbing contractor)", title: "Plumbing subcontractor" },
    services: { name: "Ridgeline Tool Hire", inName: "Ridgeline Tool Hire Pvt Ltd", title: "Rental Coordinator", type: "both" },
  },
  bills: {
    bill1: { ref: "NEW-1190", lines: [{ name: "Copper cable 2.5 sq mm — 20 coils", quantity: 1800, price: 0.8, in: { price: 29, hsnSac: "8544", slab: 18 } }, { name: "MCBs and RCCBs", quantity: 40, price: 18, in: { price: 650, hsnSac: "8536", slab: 18 } }] },
    bill2: { ref: "CAD-4410", lines: [{ name: "Split AC units 1.5 ton", quantity: 6, price: 680, in: { price: 34500, hsnSac: "8415", slab: 18 } }] },
    bill3: { ref: "MA-077", lines: [{ name: "Plumbing labour — school strip-out", quantity: 1, price: 1500, service: true, in: { price: 38000, hsnSac: "995462", slab: 18 } }] },
    bill4: { ref: "RTH-2205", lines: [{ name: "Scissor lift hire — 4 days", quantity: 4, price: 180, service: true, in: { price: 5500, hsnSac: "9973", slab: 18 } }] },
    bill5: { ref: "NEW-1288", lines: [{ name: "Ducting and insulation", quantity: 140, price: 22, in: { price: 780, hsnSac: "7306", slab: 18 } }] },
    bill6: { ref: "CAD-4502", lines: [{ name: "Cassette AC units", quantity: 4, price: 950, in: { price: 52000, hsnSac: "8415", slab: 18 } }] },
    bill7: { ref: "RTH-2261", lines: [{ name: "Pipe threader hire — 2 days", quantity: 2, price: 75, service: true, in: { price: 2200, hsnSac: "9973", slab: 18 } }] },
    // US-ONB-33: 90+ days late, 31–60 days late on a job, and two paid together.
    bill8: { ref: "NEW-1162", lines: [{ name: "Conduit and fittings", quantity: 200, price: 3.5, in: { price: 140, hsnSac: "3917", slab: 18 } }] },
    bill9: { ref: "RTH-2238", lines: [{ name: "Core drill hire — 3 days", quantity: 3, price: 85, service: true, in: { price: 2600, hsnSac: "9973", slab: 18 } }] },
    bill10: { ref: "CAD-4446", lines: [{ name: "Copper pipe coils", quantity: 10, price: 95, in: { price: 4200, hsnSac: "7411", slab: 18 } }] },
    bill11: { ref: "CAD-4468", lines: [{ name: "Refrigerant cylinders", quantity: 4, price: 120, in: { price: 5600, hsnSac: "2903", slab: 18 } }] },
  },
  recurringBill: { name: "Van tool storage", line: { name: "Tool storage unit — monthly", quantity: 1, price: 210, service: true, in: { price: 6000, hsnSac: "997212", slab: 18 } } },
  expenses: {
    exp1: { category: "Vehicle & fuel", amount: 210, inAmount: 7200, description: "Van fuel — month", paidBy: "company" },
    exp2: { category: "Permits & certification", amount: 320, inAmount: 9500, description: "Electrical safety certificate renewal", paidBy: "company" },
    exp3: { category: "Tools & equipment", amount: 180, inAmount: 5400, description: "Pipe threader — office tower job", paidBy: "employee" },
    exp4: { category: "Parts & consumables", amount: 45, inAmount: 1300, description: "Fittings bought on a call-out", paidBy: "employee" },
    exp5: { category: "Vehicle & fuel", amount: 85, inAmount: 2600, description: "Team dinner after the commissioning", paidBy: "employee" },
  },
  creditNote: { reason: "Electrician hours over-billed — corrected after the client's review.", line: 0, quantity: 6 },
  meetings: [
    { title: "Shutdown planning — office tower", slot: "anchor", startInDays: -3, durationHours: 1, atSite: true, description: "Agree the weekend shutdown for the ducting works." },
    { title: "Handover — school plumbing", slot: "institution", startInDays: -9, durationHours: 1, atSite: true, description: "Pressure test witnessed by the business manager." },
    { title: "Panel delivery — factory upgrade", slot: "regional", startInDays: 2, durationHours: 2, atSite: true, description: null },
    { title: "Crew roster", slot: null, startInDays: 1, durationHours: 1, atSite: false, description: "Internal — call-outs and installs for next week." },
  ],
};
