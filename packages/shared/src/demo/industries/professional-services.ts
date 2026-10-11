import type { IndustryPack } from "../scenario.ts";

/**
 * Professional services: an advisory and accounting practice with monthly
 * retainers, audits, tax work and a client abroad. No jobs — the template
 * starts with Jobs & field off. GST: management consulting (SAC 998311),
 * auditing (998221), accounting (998222), tax preparation (998231), legal
 * documentation (9982) and training (999293) at 18%; exports go out under
 * LUT.
 */
export const PROFESSIONAL_SERVICES: IndustryPack = {
  industry: "professional_services",
  label: "Accounting & advisory",
  exports: true,
  businessNames: {
    US: "Hartwell & Lowe Advisory",
    IN: "Mehta Rao & Associates",
    GB: "Whitcombe Partners",
    AU: "Banksia Advisory",
    NZ: "Rimu Accounting Partners",
    AE: "Crescent Advisory",
    SA: "Al Yamamah Advisory",
  },
  inLegalName: "Mehta Rao & Associates LLP",
  items: [
    { key: "advisory", name: "Advisory (hourly)", description: "Partner time on strategy, deals and funding.", unit: "hour", category: "Advisory", price: 180, service: true, in: { price: 4500, hsnSac: "998311", slab: 18 } },
    { key: "audit", name: "Statutory audit", description: "Annual audit and the auditor's report.", unit: "each", category: "Assurance", price: 6500, service: true, in: { price: 150000, hsnSac: "998221", slab: 18 } },
    { key: "bookkeeping", name: "Bookkeeping", description: "Monthly bookkeeping and management accounts.", unit: "month", category: "Accounting", price: 650, service: true, in: { price: 18000, hsnSac: "998222", slab: 18 } },
    { key: "taxreturn", name: "Tax return preparation", description: "Annual return, computation and filing.", unit: "each", category: "Tax", price: 900, service: true, in: { price: 25000, hsnSac: "998231", slab: 18 } },
    { key: "payroll", name: "Payroll processing", description: "Monthly payroll for up to 25 people.", unit: "month", category: "Accounting", price: 400, service: true, in: { price: 12000, hsnSac: "998222", slab: 18 } },
    { key: "retainer", name: "Advisory retainer", description: "Up to 12 hours of advice a month.", unit: "month", category: "Advisory", price: 2500, service: true, in: { price: 75000, hsnSac: "998311", slab: 18 } },
    { key: "diligence", name: "Due diligence review", description: "Financial due diligence report for a transaction.", unit: "each", category: "Assurance", price: 12000, service: true, in: { price: 400000, hsnSac: "998221", slab: 18 } },
    { key: "secretarial", name: "Company secretarial (annual)", description: "Annual filings, minutes and registers.", unit: "year", category: "Compliance", price: 1500, service: true, in: { price: 45000, hsnSac: "9982", slab: 18 } },
    { key: "training", name: "Finance training workshop", description: "Half-day workshop for a client's team.", unit: "each", category: "Training", price: 2000, service: true, in: { price: 60000, hsnSac: "999293", slab: 18 } },
  ],
  leads: {
    anchor: { title: "Annual audit and tax", value: 18000, stage: "won", source: "Referral", activity: { type: "meeting", notes: "Audit planning with the CFO.", dueInDays: 4 } },
    regional: { title: "Bookkeeping and payroll", value: 14000, stage: "won", source: "Website", activity: { type: "call", notes: "Month-end close timetable agreed.", dueInDays: 2 } },
    consumer: { title: "Personal tax return", value: 900, stage: "proposal", source: "Referral", activity: { type: "task", notes: "Chase the bank statements for the return.", dueInDays: 3 } },
    consumer_far: { title: "Wealth and succession planning", value: 5400, stage: "won", source: "Referral", activity: { type: "note", notes: "Plan delivered; balance due next week.", dueInDays: -2 } },
    institution: { title: "Grant audit and training", value: 12000, stage: "won", source: "Tender", activity: { type: "call", notes: "Board wants the training before year end.", dueInDays: 6 } },
    sez: { title: "Transfer pricing review", value: 15000, stage: "qualified", source: "Partner", activity: { type: "meeting", notes: "Scoping call with their finance head.", dueInDays: 7 } },
    overseas: { title: "Market-entry advisory", value: 20000, stage: "won", source: "Referral", activity: { type: "call", notes: "Monthly update to the client's board.", dueInDays: 5 } },
  },
  quotes: [
    { slot: "anchor", title: "Advisory retainer — 12 months", validUntilInDays: 30, notes: "Advisory retainer — next 12 months.", terms: "Billed monthly in advance. Valid for 30 days.", lines: [["retainer", 12]], outcome: "sent" },
    { slot: "regional", title: "Payroll for three branches", validUntilInDays: 21, notes: "Payroll for three more branches — volume pricing.", lines: [["payroll", 36, 30], ["bookkeeping", 12, 30], ["advisory", 6]], outcome: "draft" },
    { slot: "institution", title: "Board finance training", validUntilInDays: 14, notes: "Finance training for the board and managers.", terms: "Two workshops, dates to agree.", lines: [["training", 2], ["advisory", 4]], outcome: "sent" },
    { slot: "consumer", title: "Personal tax return", validUntilInDays: 45, notes: "Personal tax — revised to add the rental property; see the latest version.", lines: [["taxreturn", 1], ["advisory", 3]], outcome: "revised" },
    { slot: "overseas", title: "Entity set-up advice", validUntilInDays: 10, notes: "Entity set-up advice — pending the client's structure chart.", lines: [["advisory", 24], ["secretarial", 1]], outcome: "draft" },
  ],
  lostLead: { title: "Group audit — tender", value: 22000, lines: [["audit", 1], ["advisory", 20]], note: "Our fee came in above their budget." },
  bundles: [
    { name: "Small business compliance", description: "A year of bookkeeping, the tax return and company secretarial work.", items: [["bookkeeping", 12], ["taxreturn", 1], ["secretarial", 1]] },
    { name: "Payroll set-up", description: "A year of payroll with set-up advice.", items: [["payroll", 12], ["advisory", 4]] },
  ],
  invoices: {
    inv01: { notes: "Statutory audit — last financial year.", lines: [["audit", 1]] },
    inv02: { notes: "Personal tax return.", lines: [["taxreturn", 1]] },
    inv03: { notes: "Bookkeeping and payroll — quarter.", lines: [["bookkeeping", 3], ["payroll", 3]] },
    inv04: { notes: "Grant audit.", lines: [["audit", 1], ["advisory", 4]] },
    inv05: { notes: "Transfer pricing — benchmarking study.", lines: [["advisory", 40]] },
    inv06: { notes: "Advisory retainer — two months.", lines: [["retainer", 2]] },
    inv07: { notes: "Training workshop (raised against the wrong order).", lines: [["training", 1]] },
    inv08: { notes: "Bookkeeping and payroll — month.", lines: [["bookkeeping", 1], ["payroll", 1], ["advisory", 4]] },
    inv09: { notes: "Transfer pricing — documentation.", lines: [["advisory", 30], ["secretarial", 1]] },
    inv10: { notes: "Market-entry advisory — month 3.", lines: [["advisory", 50]] },
    inv11: { notes: "Wealth and succession planning.", lines: [["advisory", 30]] },
    inv12: { notes: "Tax notice reply.", lines: [["advisory", 3]] },
    inv13: { notes: "Advisory retainer and extra hours — this month.", lines: [["advisory", 16], ["retainer", 1]] },
    inv14: { notes: "Finance training workshop.", lines: [["training", 1]] },
    inv15: { notes: "Due diligence — draft until the deal signs.", lines: [["diligence", 1]] },
  },
  vendors: {
    supplier: { name: "LedgerLink Software", inName: "LedgerLink Software Pvt Ltd", title: "Account Manager" },
    supplier_far: { name: "Juris Research Services", inName: "Juris Research Services Pvt Ltd", title: "Client Services" },
    local: { name: "Kate Morgan (contract accountant)", inName: "Karthik Menon (article assistant)", title: "Contract accountant" },
    services: { name: "Metro Co-working Spaces", inName: "Metro Co-working Spaces Pvt Ltd", title: "Community Manager" },
  },
  bills: {
    bill1: { ref: "LLS-5520", lines: [{ name: "Practice software — annual seats", quantity: 8, price: 180, service: true, in: { price: 6000, hsnSac: "997331", slab: 18 } }] },
    bill2: { ref: "JRS-0412", lines: [{ name: "Tax research database — annual", quantity: 1, price: 2200, service: true, in: { price: 72000, hsnSac: "9983", slab: 18 } }] },
    bill3: { ref: "KM-08", lines: [{ name: "Contract accountant — audit fieldwork", quantity: 1, price: 2600, service: true, in: { price: 55000, hsnSac: "998222", slab: 18 } }] },
    bill4: { ref: "MCS-3019", lines: [{ name: "Meeting room hire", quantity: 4, price: 120, service: true, in: { price: 3500, hsnSac: "997212", slab: 18 } }] },
    bill5: { ref: "LLS-5611", lines: [{ name: "Document management add-on", quantity: 8, price: 40, service: true, in: { price: 1400, hsnSac: "997331", slab: 18 } }] },
    bill6: { ref: "JRS-0533", lines: [{ name: "Company filings search pack", quantity: 1, price: 450, service: true, in: { price: 14000, hsnSac: "9983", slab: 18 } }] },
    bill7: { ref: "MCS-3088", lines: [{ name: "Training room hire — full day", quantity: 1, price: 380, service: true, in: { price: 9500, hsnSac: "997212", slab: 18 } }] },
  },
  recurringBill: { name: "Co-working desks", line: { name: "Dedicated desks — monthly", quantity: 3, price: 290, service: true, in: { price: 8500, hsnSac: "997212", slab: 18 } } },
  expenses: {
    exp1: { category: "Subscriptions & research", amount: 280, inAmount: 8500, description: "Professional journal subscriptions", paidBy: "company" },
    exp2: { category: "Insurance", amount: 1400, inAmount: 42000, description: "Professional indemnity premium — instalment", paidBy: "company" },
    exp3: { category: "Travel", amount: 190, inAmount: 5600, description: "Train fare to the client's site", paidBy: "employee" },
    exp4: { category: "Office supplies", amount: 55, inAmount: 1600, description: "Printer toner", paidBy: "employee" },
    exp5: { category: "Travel", amount: 150, inAmount: 4500, description: "Client dinner after the audit close", paidBy: "employee" },
  },
  creditNote: { reason: "Advisory hours over-billed — corrected after the client's review.", line: 0, quantity: 4 },
  meetings: [
    { title: "Audit planning — annual audit", slot: "anchor", startInDays: -3, durationHours: 1, atSite: true, description: "Agree the timetable and the list of schedules." },
    { title: "Board update — market entry", slot: "overseas", startInDays: -10, durationHours: 1, atSite: false, description: "Video call with the client's board." },
    { title: "Month-end close — bookkeeping", slot: "regional", startInDays: 3, durationHours: 1, atSite: false, description: null },
    { title: "Partners' meeting", slot: null, startInDays: 1, durationHours: 1, atSite: false, description: "Internal — workload and billing review." },
  ],
};
