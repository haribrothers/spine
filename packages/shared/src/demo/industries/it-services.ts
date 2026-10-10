import type { IndustryPack } from "../scenario.ts";

/**
 * IT services & agency: discovery workshops, fixed-price builds, hourly
 * development, monthly hosting and support, and work for a client abroad.
 * GST: IT consulting (SAC 998313), design and development (998314),
 * hosting (998315), infrastructure management (998316), advertising
 * (998361) and software licences (997331) at 18%; exports go out under LUT.
 */
export const IT_SERVICES: IndustryPack = {
  industry: "it_services",
  label: "IT services & digital agency",
  exports: true,
  businessNames: {
    US: "Northwind Digital",
    IN: "Nimbus Bay Technologies",
    GB: "Fernbrook Digital",
    AU: "Bluegum Labs",
    NZ: "Kōwhai Digital",
    AE: "Mirage Tech Studio",
    SA: "Rawabi Digital",
  },
  inLegalName: "Nimbus Bay Technologies Private Limited",
  items: [
    { key: "discovery", name: "Discovery workshop", description: "Two days of workshops, then a written scope and estimate.", unit: "each", category: "Consulting", price: 3000, service: true, in: { price: 90000, hsnSac: "998313", slab: 18 } },
    { key: "dev", name: "Software development", description: "Senior developer, billed hourly.", unit: "hour", category: "Development", price: 110, service: true, in: { price: 2800, hsnSac: "998314", slab: 18 } },
    { key: "design", name: "UI/UX design", description: "Product designer, billed hourly.", unit: "hour", category: "Design", price: 95, service: true, in: { price: 2200, hsnSac: "998314", slab: 18 } },
    { key: "website", name: "Website build (fixed price)", description: "Up to 12 pages on our CMS, with launch support.", unit: "each", category: "Development", price: 8500, service: true, in: { price: 350000, hsnSac: "998314", slab: 18 } },
    { key: "hosting", name: "Managed cloud hosting", description: "Hosting, backups and monitoring, monthly.", unit: "month", category: "Hosting", price: 350, service: true, in: { price: 12000, hsnSac: "998315", slab: 18 } },
    { key: "support", name: "Support retainer", description: "Up to 20 support hours a month, next-day response.", unit: "month", category: "Support", price: 1200, service: true, in: { price: 45000, hsnSac: "998316", slab: 18 } },
    { key: "seo", name: "SEO & digital marketing", description: "Monthly campaign management and reporting.", unit: "month", category: "Marketing", price: 900, service: true, in: { price: 35000, hsnSac: "998361", slab: 18 } },
    { key: "laptop", name: "Business laptop (resale)", description: "14-inch, 16 GB, set up and enrolled.", unit: "each", category: "Hardware", price: 1100, in: { price: 68000, hsnSac: "8471", slab: 18 } },
    { key: "licence", name: "Software licence (annual)", description: "Annual subscription, per user.", unit: "each", category: "Licences", price: 600, service: true, in: { price: 24000, hsnSac: "997331", slab: 18 } },
  ],
  leads: {
    anchor: { title: "Customer portal build", value: 65000, stage: "won", source: "Referral", activity: { type: "meeting", notes: "Sprint review with the product owner.", dueInDays: 4 } },
    regional: { title: "E-commerce replatform", value: 48000, stage: "won", source: "Website", activity: { type: "call", notes: "Agreed the cut-over weekend.", dueInDays: 2 } },
    consumer: { title: "Portfolio website", value: 3000, stage: "proposal", source: "LinkedIn", activity: { type: "task", notes: "Send the two design options.", dueInDays: 3 } },
    consumer_far: { title: "Clinic website for a doctor", value: 9000, stage: "won", source: "Referral", activity: { type: "note", notes: "Site live; balance due next week.", dueInDays: -2 } },
    institution: { title: "Patient booking app", value: 36000, stage: "won", source: "Tender", activity: { type: "call", notes: "Security review booked with their IT team.", dueInDays: 6 } },
    sez: { title: "Internal dashboards", value: 24000, stage: "qualified", source: "Partner", activity: { type: "meeting", notes: "Data workshop with their analysts.", dueInDays: 7 } },
    overseas: { title: "Booking engine integration", value: 30000, stage: "won", source: "Upwork", activity: { type: "call", notes: "Weekly call with the client's CTO.", dueInDays: 5 } },
  },
  quotes: [
    { slot: "anchor", title: "Customer portal — mobile app", validUntilInDays: 30, notes: "Phase 2 — mobile app for the customer portal.", terms: "Billed monthly for hours worked. Valid for 30 days.", lines: [["discovery", 1], ["dev", 320], ["design", 80]], outcome: "sent" },
    { slot: "regional", title: "Store laptops and licences", validUntilInDays: 21, notes: "Laptops and licences for the new store team — volume pricing.", lines: [["laptop", 15, 30], ["licence", 15, 30], ["dev", 16]], outcome: "draft" },
    { slot: "institution", title: "Booking app support retainer", validUntilInDays: 14, notes: "Support retainer for the booking app, 12 months.", terms: "Billed monthly in advance.", lines: [["support", 12], ["hosting", 12]], outcome: "sent" },
    { slot: "consumer", title: "Portfolio website", validUntilInDays: 45, notes: "Portfolio website — revised with a blog; see the latest version.", lines: [["design", 16], ["dev", 30], ["hosting", 12]], outcome: "revised" },
    { slot: "overseas", title: "Channel manager integration", validUntilInDays: 10, notes: "Channel manager integration — pending their API access.", lines: [["dev", 120], ["support", 3]], outcome: "draft" },
  ],
  lostLead: { title: "Loyalty app — pitch", value: 40000, lines: [["discovery", 1], ["design", 60], ["dev", 200]], note: "Went with an offshore team at a lower day rate." },
  bundles: [
    { name: "Website starter", description: "Design, a fixed-price site and a year of hosting.", items: [["design", 16], ["website", 1], ["hosting", 12]] },
    { name: "New starter kit", description: "A laptop, its software licence and a month of support.", items: [["laptop", 1], ["licence", 1], ["support", 1]] },
  ],
  invoices: {
    inv01: { notes: "Customer portal — discovery workshop.", lines: [["discovery", 1]] },
    inv02: { notes: "Landing page and hosting setup.", lines: [["design", 6], ["dev", 10], ["hosting", 1]] },
    inv03: { notes: "E-commerce — UX design sprint.", lines: [["design", 60], ["dev", 20]] },
    inv04: { notes: "Booking app — discovery and prototype.", lines: [["discovery", 1], ["design", 30]] },
    inv05: { notes: "Dashboards — data model and first reports.", lines: [["dev", 90]] },
    inv06: { notes: "Customer portal — hosting and support, two months.", lines: [["hosting", 2], ["support", 2]] },
    inv07: { notes: "Booking app — licences (raised against the wrong order).", lines: [["licence", 10]] },
    inv08: { notes: "E-commerce — integrations sprint.", lines: [["dev", 110]] },
    inv09: { notes: "Dashboards — second release.", lines: [["dev", 70], ["design", 10]] },
    inv10: { notes: "Booking engine integration — month 2.", lines: [["dev", 140], ["support", 1]] },
    inv11: { notes: "Clinic website — build and launch.", lines: [["website", 1], ["hosting", 3]] },
    inv12: { notes: "Laptop setup for a home office.", lines: [["laptop", 1], ["licence", 1]] },
    inv13: { notes: "Customer portal — development hours, this month.", lines: [["dev", 120], ["seo", 1]] },
    inv14: { notes: "Booking app — support and hosting.", lines: [["support", 1], ["hosting", 1]] },
    inv15: { notes: "Customer portal — SEO, next quarter (draft until agreed).", lines: [["seo", 3]] },
  },
  jobs: {
    a: { slot: "anchor", name: "Customer portal build", value: 65000, inValue: 2400000, retentionPct: 0, milestones: [["Discovery & design", 15], ["Build", 60], ["Launch & handover", 25]], sac: "998314" },
    b: { slot: "regional", name: "E-commerce replatform", value: 48000, inValue: 1800000, retentionPct: 0, milestones: [["Design", 30], ["Build & integrations", 40], ["Go-live", 30]], sac: "998314" },
    c: { slot: "institution", name: "Patient booking app", value: 36000, inValue: 1350000, retentionPct: 0, milestones: [["Prototype", 30], ["Build", 40], ["Launch", 30]], sac: "998314" },
    releaseRetention: false,
  },
  variationOrder: { notes: "Change request: add a second payment gateway.", lines: [{ name: "Payment gateway integration (change request)", quantity: 1, price: 4000, service: true, in: { price: 150000, hsnSac: "998314", slab: 18 } }] },
  vendors: {
    supplier: { name: "Cloudbase Hosting", inName: "Cloudbase Hosting Pvt Ltd", title: "Account Manager" },
    supplier_far: { name: "DevHire Talent", inName: "DevHire Talent Solutions Pvt Ltd", title: "Delivery Manager" },
    local: { name: "Alex Kim (freelance designer)", inName: "Ankit Sharma (freelance designer)", title: "Freelance designer" },
    services: { name: "Compushop Hardware", inName: "Compushop Hardware Pvt Ltd", title: "Corporate Sales", type: "both" },
  },
  bills: {
    bill1: { ref: "CBH-INV-3310", lines: [{ name: "Cloud servers — client environments", quantity: 3, price: 420, service: true, in: { price: 15000, hsnSac: "998315", slab: 18 } }] },
    bill2: { ref: "DHT-0921", lines: [{ name: "Contract developer — 120 hours", quantity: 120, price: 55, service: true, in: { price: 1400, hsnSac: "998314", slab: 18 } }] },
    bill3: { ref: "AS-12", lines: [{ name: "Illustrations for the booking app", quantity: 1, price: 1200, service: true, in: { price: 32000, hsnSac: "998391", slab: 18 } }] },
    bill4: { ref: "CSH-7781", lines: [{ name: "Laptops for resale", quantity: 2, price: 880, in: { price: 56000, hsnSac: "8471", slab: 18 } }] },
    bill5: { ref: "CBH-INV-3402", lines: [{ name: "Managed database — portal", quantity: 1, price: 380, service: true, in: { price: 13500, hsnSac: "998315", slab: 18 } }] },
    bill6: { ref: "DHT-1003", lines: [{ name: "Contract QA engineer — 80 hours", quantity: 80, price: 45, service: true, in: { price: 1100, hsnSac: "998314", slab: 18 } }] },
  },
  expenses: {
    exp1: { category: "Software subscriptions", amount: 240, inAmount: 7200, description: "Design tool seats — quarter", paidBy: "company" },
    exp2: { category: "Training & certification", amount: 450, inAmount: 15000, description: "Cloud certification exam", paidBy: "company" },
    exp3: { category: "Travel", amount: 160, inAmount: 4800, description: "Taxi to the client's office — portal sprint review", paidBy: "employee" },
    exp4: { category: "Hosting & cloud", amount: 35, inAmount: 950, description: "Domain renewal", paidBy: "employee" },
    exp5: { category: "Travel", amount: 120, inAmount: 3600, description: "Team dinner after go-live", paidBy: "employee" },
  },
  creditNote: { reason: "Development hours over-billed — corrected after the client's review.", line: 0, quantity: 12 },
  meetings: [
    { title: "Sprint review — customer portal", slot: "anchor", startInDays: -3, durationHours: 1, atSite: false, description: "Demo of the account pages." },
    { title: "Weekly call — booking engine", slot: "overseas", startInDays: -7, durationHours: 1, atSite: false, description: "Video call with the client's CTO." },
    { title: "Security review — booking app", slot: "institution", startInDays: 3, durationHours: 2, atSite: true, description: null },
    { title: "Sprint planning", slot: null, startInDays: 1, durationHours: 1, atSite: false, description: "Internal — next sprint's priorities." },
  ],
};
