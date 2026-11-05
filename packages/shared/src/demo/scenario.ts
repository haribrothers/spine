import { gstinCheckCharacter } from "../tax/gst.ts";
import type { GstTreatment } from "../tax/gst.ts";
import type { TaxCountry } from "../tax/presets/types.ts";
import type { DemoCountry, DemoIndustry, DemoPlan, DemoPlanBanking, DemoPlanContact, DemoPlanLead, DemoPlanLine, DemoPlanMilestone, DemoPlanQuote, DemoTax, DemoTaxRef } from "./types.ts";

/**
 * US-ONB-18 (D-192) — a demo business is an industry pack written once,
 * localised by a country pack. The industry says what the business sells
 * and does over about six months (the shared timeline below); the country
 * says who its customers and vendors are, what things cost there and which
 * tax applies. India's prices, HSN/SAC codes and GST slabs are written by
 * hand in each industry pack.
 */

/** Who a document is for. In India each slot is a different GST case. */
export type CustomerSlot =
  | "anchor" // a registered business in the same state: B2B, CGST + SGST
  | "regional" // a registered business in another state: B2B, IGST
  | "consumer" // a person in the same state: B2C small
  | "consumer_far" // a person in another state: B2C large above ₹1,00,000
  | "institution" // a hospital, school or hotel in the same state
  | "sez" // an SEZ unit (elsewhere, a second local business)
  | "overseas"; // a client abroad: an export
export type VendorSlot = "supplier" | "supplier_far" | "local" | "services";
export type TaxRole = "standard" | "reduced" | "zero" | "exempt";

/** India's GST slabs in use (rates from 22 September 2025). */
export type GstSlab = 0 | 0.25 | 3 | 5 | 18 | 40;

export interface IndustryItem {
  key: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  /** Price in US dollars; other countries scale it (CountryPack.scale). */
  price: number;
  /** A service: untaxed in the United States, where most states don't tax services. */
  service?: boolean;
  role?: TaxRole;
  /** A different tax role in one country (UK new-build homes are zero-rated). */
  roleIn?: Partial<Record<DemoCountry, TaxRole>>;
  /** India, by hand: the price in rupees, the HSN or SAC code and the GST slab. */
  in: { price: number; hsnSac: string; slab: GstSlab };
}

export type IndustryLine = [item: string, quantity: number, discount?: number];

/** A typed-in line on a bill or variation order. */
export interface IndustryFreeLine {
  name: string;
  quantity: number;
  price: number;
  in: { price: number; hsnSac: string; slab: GstSlab };
  service?: boolean;
}

export interface IndustryJob {
  slot: CustomerSlot;
  name: string;
  value: number;
  inValue: number;
  retentionPct: number;
  milestones: [string, number][];
  /** India: the SAC for its milestone invoices (18%). */
  sac: string;
}

export interface IndustryPack {
  industry: DemoIndustry;
  /** `business_profile.industry`. */
  label: string;
  /** Sells abroad: invoice 10 goes to the overseas client. */
  exports: boolean;
  businessNames: Record<DemoCountry, string>;
  /** India: the legal name on the GST registration. */
  inLegalName: string;
  items: IndustryItem[];
  leads: Record<CustomerSlot, { title: string; value: number; stage: "new" | "qualified" | "proposal" | "won" | "lost"; source: string; activity: { type: "call" | "meeting" | "note" | "task"; notes: string; dueInDays: number } }>;
  /** In timeline order (QUOTE_TIMELINE): anchor, regional, institution, consumer, and the SEZ or overseas client. */
  quotes: { slot: CustomerSlot; title: string; validUntilInDays: number; notes: string; terms?: string; lines: IndustryLine[]; outcome: "draft" | "sent" | "revised" }[];
  /** US-ONB-24 — a tender the regional customer gave to someone else on price, with its declined quote. */
  lostLead: { title: string; value: number; lines: IndustryLine[]; note: string };
  /** US-ONB-27 */
  bundles: { name: string; description: string; items: [string, number][] }[];
  /** Lines and notes for each invoice of the timeline, by key. */
  invoices: Record<InvoiceKey, { notes: string; lines: IndustryLine[] }>;
  jobs?: { a: IndustryJob; b: IndustryJob; c: IndustryJob; releaseRetention: boolean };
  variationOrder?: { notes: string; lines: IndustryFreeLine[] };
  vendors: Record<VendorSlot, { name: string; inName: string; title: string; type?: "vendor" | "both" }>;
  bills: Record<BillKey, { ref: string; lines: IndustryFreeLine[] }>;
  /** US-ONB-30 — a monthly bill from the services vendor. */
  recurringBill: { name: string; line: IndustryFreeLine };
  expenses: Record<ExpenseKey, { category: string; amount: number; inAmount: number; description: string; paidBy: "company" | "employee" }>;
  creditNote: { reason: string; line: number; quantity: number };
  /** `weekly`: the internal planning meeting, which repeats every week (US-ONB-09). */
  meetings: { title: string; slot: CustomerSlot | null; startInDays: number; durationHours: number; atSite: boolean; description: string | null; weekly?: boolean }[];
}

/** The six-month timeline every industry shares. Payments are full unless a fraction is given. */
export const INVOICE_TIMELINE = [
  { key: "inv01", slot: "anchor", issue: -165, due: -135, paid: [[-150, "full"]] },
  { key: "inv02", slot: "consumer", issue: -140, due: -126, paid: [[-136, "full"]] },
  { key: "inv03", slot: "regional", issue: -118, due: -88, paid: [[-92, "full"]] },
  { key: "inv04", slot: "institution", issue: -96, due: -66, paid: [[-70, "full"]] },
  { key: "inv05", slot: "sez", issue: -74, due: -44, paid: [[-50, "full"]] },
  { key: "inv06", slot: "anchor", issue: -58, due: -28, paid: [[-35, 0.5]], emailed: -58, reminded: -20 },
  // Raised by mistake and voided the same day: a void posts on the day it's made (D-185), so an earlier
  // invoice voided today would put this month's Tax Summary out of step with this month's GSTR-1.
  { key: "inv07", slot: "institution", issue: null, due: 30, voided: "Raised against the wrong purchase order — reissued." },
  { key: "inv08", slot: "regional", issue: -26, due: -11, emailed: -26, reminded: -4 },
  // India: an SEZ supply under LUT, zero-rated by hand (SEWOP); the earlier one carried IGST (SEWP).
  { key: "inv09", slot: "sez", issue: -22, due: 8, zeroRatedInIndia: true },
  { key: "inv10", slot: "overseas", issue: -18, due: 12, paid: [[-4, "full"]] },
  { key: "inv11", slot: "consumer_far", issue: -12, due: 2, paid: [[-5, 0.4]], emailed: -12 },
  { key: "inv12", slot: "consumer", issue: -8, due: 6, paid: [[-2, "full"]] },
  { key: "inv13", slot: "anchor", issue: -6, due: 24, emailed: -6 },
  { key: "inv14", slot: "institution", issue: -3, due: 27 },
  { key: "inv15", slot: "anchor", issue: null, due: 30, draft: true },
] as const satisfies readonly {
  key: string;
  slot: CustomerSlot;
  issue: number | null;
  due: number;
  paid?: readonly (readonly [number, "full" | number])[];
  voided?: string;
  draft?: boolean;
  zeroRatedInIndia?: boolean;
  /** US-ONB-28: emailed on its issue day, and chased once it was late. */
  emailed?: number;
  reminded?: number;
}[];
export type InvoiceKey = (typeof INVOICE_TIMELINE)[number]["key"];

export const BILL_TIMELINE = [
  { key: "bill1", vendor: "supplier", date: -150, due: -120, paid: -125, method: "cheque" },
  { key: "bill2", vendor: "supplier_far", date: -60, due: -30 },
  { key: "bill3", vendor: "local", date: -40, due: -40, paid: -38, method: "cash" },
  { key: "bill4", vendor: "services", date: -90, due: -60, voided: "Entered twice — the vendor's statement shows one charge." },
  // US-ONB-30: part-paid and due this week.
  { key: "bill5", vendor: "supplier", date: -10, due: 4, paid: -2, part: 0.4, job: "a", method: "bank_transfer" },
  { key: "bill6", vendor: "supplier_far", date: -3, due: 27, draft: true },
  { key: "bill7", vendor: "services", date: -2, due: 28, draft: true },
  // US-ONB-33: 90+ days late from the part-paid bill's vendor (two open bills), 31–60 days late on a job, and two paid together.
  { key: "bill8", vendor: "supplier", date: -130, due: -100 },
  { key: "bill9", vendor: "services", date: -75, due: -45, job: "b" },
  { key: "bill10", vendor: "supplier_far", date: -50, due: -20 },
  { key: "bill11", vendor: "supplier_far", date: -44, due: -14 },
] as const satisfies readonly { key: string; vendor: VendorSlot; date: number; due: number; paid?: number; part?: number; method?: "bank_transfer" | "cheque" | "cash"; voided?: string; draft?: boolean; job?: "a" | "b" | "c" }[];

/** US-ONB-33 — the payment that pays two bills together, about five weeks ago, with its remittance advice emailed the next day. */
export const SHARED_VENDOR_PAYMENT = { vendor: "supplier_far", bills: ["bill10", "bill11"], inDays: -35, remittanceInDays: -34 } as const satisfies { vendor: VendorSlot; bills: readonly BillKey[]; inDays: number; remittanceInDays: number };

/** US-ONB-34 — the bank that issues the demo's business card, by country. */
const DEMO_CARD_BANK: Record<string, string> = { US: "First Coastal Bank", IN: "HDFC Bank", GB: "Barclays", AU: "Westpac", NZ: "ANZ", AE: "Emirates NBD", SA: "Al Rajhi Bank" };

/** US-ONB-34 (D-231) — the demo's banking, in the country's money (whole units: rupees, or dollars and the like). */
export function demoBanking(country: string): DemoPlanBanking {
  const minor = (units: number) => BigInt(Math.round(units * 100));
  const india = country === "IN";
  return {
    card: { name: "Business card", bankName: DEMO_CARD_BANK[country] ?? "First Coastal Bank", last4: "4410" },
    cardSpend: india ? [minor(2999), minor(4200)] : [minor(49), minor(85)],
    pettyCash: india ? minor(10000) : minor(300),
    interest: india ? minor(1240.5) : minor(12.4),
    bankCharges: india ? minor(590) : minor(15),
    smsCharges: india ? minor(59) : minor(2.95),
  };
}

/** US-ONB-33 — a bank transfer's or cheque's reference, the way the country's banks write it. */
export function vendorPaymentReference(country: string, method: "bank_transfer" | "cheque", serial: number): string {
  if (method === "cheque") return `Chq ${String(4500 + serial).padStart(6, "0")}`;
  const prefix: Record<string, string> = { US: "ACH", IN: "NEFT", GB: "BACS", AU: "EFT", NZ: "EFT", AE: "TT", SA: "TT" };
  return `${prefix[country] ?? "TRF"} ${String(48213 + serial * 7919).slice(-6)}`;
}

export type BillKey = (typeof BILL_TIMELINE)[number]["key"];

/** US-ONB-31 — the kind of shop a demo expense's receipt comes from, by what it was for. */
export function receiptMerchant(category: string, description: string): string {
  const text = `${category} ${description}`.toLowerCase();
  if (/lunch|meal|dinner|coffee|café|cafe/.test(text)) return "Corner Café";
  if (/fuel|diesel|petrol|mileage/.test(text)) return "Highway Fuel Centre";
  if (/permit|council|licence fee|filing/.test(text)) return "City Council — Permits";
  if (/hire|rental|vibrator|scaffold/.test(text)) return "Tool & Plant Hire Co.";
  if (/software|licence|subscription|cloud|domain/.test(text)) return "Cloud Software Ltd";
  if (/travel|taxi|train|flight|parking/.test(text)) return "City Cabs";
  return "Trade Supplies Co.";
}

/** US-ONB-32 — the category every demo adds archived (unused). */
export const DEMO_ARCHIVED_CATEGORY = { name: "Client entertainment", description: "Meals and gifts for clients" };

export const EXPENSE_TIMELINE = [
  { key: "exp1", date: -120, outcome: "approved" },
  { key: "exp2", date: -60, outcome: "approved" },
  { key: "exp3", date: -25, outcome: "approved", job: "a" },
  { key: "exp4", date: -4, outcome: "submitted" },
  { key: "exp5", date: -15, outcome: "rejected" },
] as const satisfies readonly { key: string; date: number; outcome: "approved" | "submitted" | "rejected"; job?: "a" }[];
export type ExpenseKey = (typeof EXPENSE_TIMELINE)[number]["key"];

/**
 * US-ONB-25 (D-216) — what happens to each pack quote, by position: the
 * first went out weeks ago and has expired; the second (the regional
 * customer's, whose lead is won) was accepted this month; the third
 * expires this week; the fourth was revised; the fifth is a draft.
 */
const QUOTE_TIMELINE: Partial<DemoPlanQuote>[] = [
  { outcome: "sent", sentInDays: -40, validUntilInDays: -5, views: { count: 2, lastInDays: -31 } },
  { outcome: "accepted", sentInDays: -6, views: { count: 1, lastInDays: -5 }, respondedInDays: -1, thisMonth: true, comment: "Go ahead — please book the work in." },
  { outcome: "sent", sentInDays: -18, validUntilInDays: 5, views: { count: 3, lastInDays: -2 } },
  { outcome: "revised", sentInDays: -30, revisedInDays: -9, views: { count: 1, lastInDays: -26 } },
  {},
];

/** US-ONB-24 — days in stage by stage; won leads closed at these ages in turn. */
const DAYS_IN_STAGE = { new: 3, qualified: 10, proposal: 18, lost: 40 } as const;
const WON_AGES = [6, 34, 62, 95, 140, 170];
const EXPECTED_CLOSE = { new: 50, qualified: 30, proposal: 12 } as const;
/** US-ONB-27 — meetings start at different times of day, in the pack's order. */
const MEETING_TIMES = ["10:00", "15:30", "11:00", "08:30", "14:00"];
/** US-ONB-09 — the internal planning meeting repeats for the next three months. */
export const WEEKLY_MEETINGS = 12;

/**
 * Job A has just started, its first milestone due this week (so the field
 * app's Today has a job, US-MOB-03); B is half invoiced; C is finished.
 * Milestone invoices are paid after the days given.
 */
const JOB_TIMELINE = {
  a: { start: -10, due: [4, 35, 60], invoice: [undefined, undefined, undefined], complete: [undefined, undefined, undefined], paidAfter: [undefined, undefined, undefined] },
  // US-ONB-26: B's second milestone is done and waiting to be invoiced.
  b: { start: -80, due: [-64, -20, 20], invoice: [-64, undefined, undefined], complete: [undefined, -20, undefined], paidAfter: [20, undefined, undefined] },
  c: { start: -170, due: [-160, -130, -100], invoice: [-160, -130, -100], complete: [undefined, undefined, undefined], paidAfter: [15, 20, 25] },
} as const;

/** US-ONB-25, US-ONB-26 (D-216) — each job's end, budget and progress; A comes from an accepted contract quote, C is finished. */
const JOB_STATE: Record<"a" | "b" | "c", { end: number; budget: "near" | number; percentComplete?: number; completed?: boolean; fromQuote?: { sentInDays: number; viewedInDays: number; respondedInDays: number } }> = {
  a: { end: 75, budget: "near", fromQuote: { sentInDays: -16, viewedInDays: -15, respondedInDays: -12 } },
  b: { end: 30, budget: 0.75, percentComplete: 60 },
  c: { end: -95, budget: 0.7, completed: true },
};

/* ---------------------------- country packs ---------------------------- */

export interface Place {
  line1: string;
  city: string;
  state: string;
  stateCode?: string;
  postalCode: string;
  country: string;
}

export interface SlotIdentity {
  name: string;
  isCompany: boolean;
  person: { name: string; title: string };
  place: Place;
  phone: string;
  gstTreatment?: GstTreatment;
  /** India: the 10-character PAN inside the GSTIN. */
  pan?: string;
}

export interface CountryPack {
  country: DemoCountry;
  taxCountry: TaxCountry;
  currency: { code: string; locale: string };
  financialYearStart: { month: number; day: number };
  /** Local currency units per US dollar of an industry price (rounded to a sensible amount). */
  scale: number;
  business: { place: Place; phone: string; pan?: string };
  customers: Record<CustomerSlot, SlotIdentity>;
  vendors: Record<VendorSlot, { person: string; place: Place; phone: string; gstTreatment?: GstTreatment; pan?: string }>;
  /** Added to company vendor names ("Pty Ltd"). */
  legalSuffix: string;
  /** Each tax role, and exports; India's come from each item's slab instead. */
  tax?: Record<TaxRole | "export", DemoTax | null>;
  /** A country with no preset sets up its own rate. */
  ownTaxRates?: DemoPlan["ownTaxRates"];
  /** The rate an expense's tax is at, when expenses carry tax there. */
  expenseTax?: { rate: DemoTaxRef; percent: number };
  /** India: the UPI ID on invoices (a handle no bank uses, so it pays no one). */
  upiId?: string;
}

/* ------------------------------- helpers ------------------------------- */

/** A sensible local amount: whole units for small amounts, then steps of 5, 10 and 50. */
export function niceAmount(major: number): number {
  if (major < 20) return Math.round(major * 2) / 2;
  if (major < 100) return Math.round(major);
  if (major < 1000) return Math.round(major / 5) * 5;
  if (major < 10000) return Math.round(major / 10) * 10;
  return Math.round(major / 50) * 50;
}

const minor = (major: number) => BigInt(Math.round(major * 100));
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 24);
const personEmail = (name: string, domain: string) => `${name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".")}@${domain}`;

/** A GSTIN for a state and PAN, with its check character (US-TAX-12). */
export function demoGstin(stateCode: string, pan: string): string {
  const first14 = `${stateCode}${pan}1Z`;
  return `${first14}${gstinCheckCharacter(first14)}`;
}

const gstTax = (slab: GstSlab): DemoTax => (slab === 0 ? { intra: null, inter: null, supplyClass: "exempt" } : { intra: { group: `GST ${slab}%` }, inter: { rate: `IGST ${slab}%` } });

function countryTax(country: CountryPack, role: TaxRole | "export", service: boolean | undefined): DemoTax | null {
  if (country.country === "US" && service) return { intra: null, supplyClass: "non_taxable" };
  return country.tax?.[role] ?? null;
}

/* -------------------------------- builder -------------------------------- */

/** US-ONB-18 — one industry localised for one country, as a plan. */
export function localisedPlan(country: CountryPack, pack: IndustryPack): DemoPlan {
  const india = country.country === "IN";
  const price = (usd: number, inr: number) => minor(india ? inr : niceAmount(usd * country.scale));
  const businessName = pack.businessNames[country.country];
  const domain = `${slug(businessName)}.example`;

  const customerKeys = (Object.keys(country.customers) as CustomerSlot[]).filter((slot) => slot !== "overseas" || pack.exports);
  const leadValue = (value: number) => price(value, Math.round((value * 30) / 1000) * 1000);
  // US-ONB-24: open leads alternate between the owner and the demo Staff person; won leads closed at different ages.
  let openIndex = 0;
  let wonIndex = 0;
  const worked = (slot: CustomerSlot, lead: IndustryPack["leads"][CustomerSlot]): DemoPlanLead => {
    const base = { stage: lead.stage, value: leadValue(lead.value), title: lead.title, source: lead.source };
    if (lead.stage === "won") return { ...base, owner: "owner", daysInStage: WON_AGES[wonIndex++ % WON_AGES.length] };
    if (lead.stage === "lost") return { ...base, owner: "owner", daysInStage: DAYS_IN_STAGE.lost, lostReason: "other", lostNote: lead.activity.notes };
    return { ...base, owner: openIndex++ % 2 === 0 ? "staff" : "owner", daysInStage: DAYS_IN_STAGE[lead.stage], expectedCloseInDays: EXPECTED_CLOSE[lead.stage], ...(slot === "consumer" ? { cold: true } : {}) };
  };
  const contacts: DemoPlanContact[] = customerKeys.map((slot) => {
    const who = country.customers[slot];
    const lead = pack.leads[slot];
    const companyDomain = `${slug(who.name)}.example`;
    const email = who.isCompany ? `accounts@${companyDomain}` : personEmail(who.name, "example.com");
    return {
      key: slot,
      type: "customer",
      isCompany: who.isCompany,
      name: who.name,
      email,
      phone: who.phone,
      ...(who.pan && who.place.stateCode ? { taxId: demoGstin(who.place.stateCode, who.pan) } : {}),
      ...(who.isCompany ? { website: `https://${companyDomain}` } : {}),
      ...(india ? { gstTreatment: who.gstTreatment, stateCode: who.place.stateCode } : {}),
      person: { name: who.person.name, title: who.person.title, email: who.isCompany ? personEmail(who.person.name, companyDomain) : email, phone: who.phone },
      address: { line1: who.place.line1, city: who.place.city, state: who.place.state, ...(who.place.stateCode ? { stateCode: who.place.stateCode } : {}), postalCode: who.place.postalCode, country: who.place.country },
      lead: worked(slot, lead),
      activity: lead.activity,
      ...(slot === "regional" ? { lostLead: { stage: "lost" as const, value: leadValue(pack.lostLead.value), title: pack.lostLead.title, source: "Tender", owner: "owner" as const, daysInStage: 21, lostReason: "price" as const, lostNote: pack.lostLead.note } } : {}),
    };
  });
  for (const slot of Object.keys(pack.vendors) as VendorSlot[]) {
    const v = pack.vendors[slot];
    const where = country.vendors[slot];
    const isCompany = slot !== "local";
    const name = india ? v.inName : isCompany ? `${v.name}${country.legalSuffix}` : v.name;
    const vendorDomain = `${slug(name)}.example`;
    // A sole trader is their own contact person.
    const personName = isCompany ? where.person : name.replace(/\s*\(.*\)$/, "");
    contacts.push({
      key: slot,
      type: v.type ?? "vendor",
      isCompany,
      name,
      email: isCompany ? `sales@${vendorDomain}` : personEmail(personName, "example.com"),
      phone: where.phone,
      ...(where.pan && where.place.stateCode ? { taxId: demoGstin(where.place.stateCode, where.pan) } : {}),
      ...(india ? { gstTreatment: where.gstTreatment, stateCode: where.place.stateCode } : {}),
      person: { name: personName, title: v.title, email: isCompany ? personEmail(personName, vendorDomain) : personEmail(personName, "example.com"), phone: where.phone },
      address: { line1: where.place.line1, city: where.place.city, state: where.place.state, ...(where.place.stateCode ? { stateCode: where.place.stateCode } : {}), postalCode: where.place.postalCode, country: where.place.country },
    });
  }

  const items = pack.items.map((item) => ({
    key: item.key,
    name: item.name,
    description: item.description,
    unit: item.unit,
    category: item.category,
    price: price(item.price, item.in.price),
    tax: india ? gstTax(item.in.slab) : (countryTax(country, item.roleIn?.[country.country] ?? item.role ?? "standard", item.service) ?? { intra: null, supplyClass: "zero_rated" as const }),
    ...(india ? { hsnSac: item.in.hsnSac } : {}),
    income: item.service ? ("services" as const) : ("goods" as const),
  }));
  const itemByKey = new Map(pack.items.map((i) => [i.key, i]));
  /** Outside India, a line to the overseas client carries the export tax. */
  const lines = (from: IndustryLine[], slot: CustomerSlot): DemoPlanLine[] =>
    from.map(([item, quantity, discount]) => {
      const exportTax = !india && slot === "overseas" ? countryTax(country, "export", itemByKey.get(item)?.service) : undefined;
      return { item, quantity, ...(discount ? { discount } : {}), ...(exportTax !== undefined ? { tax: exportTax ?? { intra: null, supplyClass: "zero_rated" as const } } : {}) };
    });
  const freeLine = (line: IndustryFreeLine) => ({
    name: line.name,
    quantity: line.quantity,
    price: price(line.price, line.in.price),
    tax: india ? gstTax(line.in.slab) : countryTax(country, "standard", line.service),
    ...(india ? { hsnSac: line.in.hsnSac } : {}),
  });

  const invoices = INVOICE_TIMELINE.map((step) => {
    const slot: CustomerSlot = step.slot === "overseas" && !pack.exports ? "anchor" : step.slot;
    const content = pack.invoices[step.key];
    return {
      key: step.key,
      contact: slot,
      issueInDays: step.issue,
      dueInDays: step.due,
      notes: content.notes,
      lines: lines(content.lines, slot),
      outcome: "draft" in step ? ("draft" as const) : "voided" in step ? ("voided" as const) : ("issued" as const),
      ...("paid" in step ? { payments: step.paid.map(([inDays, amount]) => ({ inDays, amount, method: india ? ("upi" as const) : ("bank_transfer" as const) })) } : {}),
      ...("voided" in step ? { voidReason: step.voided } : {}),
      ...(india && "zeroRatedInIndia" in step ? { zeroRated: true } : {}),
      ...("emailed" in step ? { emailedInDays: step.emailed } : {}),
      ...("reminded" in step ? { remindedInDays: step.reminded } : {}),
    };
  });

  const jobs = pack.jobs
    ? (["a", "b", "c"] as const).map((key) => {
        const job = pack.jobs![key];
        const timing = JOB_TIMELINE[key];
        const contact = contacts.find((c) => c.key === job.slot)!;
        const siteAddress = `${contact.address.line1}, ${contact.address.city}, ${contact.address.state} ${contact.address.postalCode}`;
        const total = job.milestones.reduce((sum, [, pct]) => sum + pct, 0);
        if (total !== 100) throw new Error(`${pack.industry} job ${key}: milestones total ${total}%`);
        return {
          key,
          contact: job.slot,
          name: job.name,
          siteAddress,
          contractValue: price(job.value, job.inValue),
          retentionPct: job.retentionPct,
          startInDays: timing.start,
          milestones: job.milestones.map(([name, amount], i): DemoPlanMilestone => ({
            name,
            amountType: "percent",
            amount,
            dueInDays: timing.due[i]!,
            ...(timing.invoice[i] !== undefined ? { invoiceInDays: timing.invoice[i] } : {}),
            ...(timing.complete[i] !== undefined ? { completeInDays: timing.complete[i] } : {}),
            ...(timing.paidAfter[i] !== undefined ? { paidAfterDays: timing.paidAfter[i] } : {}),
          })),
          // Not in India: GSTR-1 would count a retention-release invoice as a supply of its own (Q-21).
          releaseRetention: key === "c" && pack.jobs!.releaseRetention && job.retentionPct > 0 && !india,
          milestoneTax: india ? { tax: gstTax(18), hsnSac: job.sac } : { tax: countryTax(country, "standard", false) ?? { intra: null, supplyClass: "zero_rated" as const } },
          note: `Kick-off on site at ${siteAddress}. Crew and dates follow the milestones below.`,
          photoCaption: "Site at kick-off.",
          endInDays: JOB_STATE[key].end,
          budget: JOB_STATE[key].budget,
          ...(JOB_STATE[key].percentComplete !== undefined ? { percentComplete: JOB_STATE[key].percentComplete } : {}),
          ...(JOB_STATE[key].completed ? { completed: true } : {}),
          ...(JOB_STATE[key].fromQuote ? { fromQuote: { title: job.name, ...JOB_STATE[key].fromQuote } } : {}),
        };
      })
    : [];

  const bills = BILL_TIMELINE.map((step) => {
    const content = pack.bills[step.key];
    return {
      contact: step.vendor,
      billNumber: content.ref,
      dateInDays: step.date,
      dueInDays: step.due,
      // A sole trader under the registration threshold charges no tax, anywhere.
      lines: content.lines.map((line) => {
        const typed = freeLine(line);
        return step.vendor === "local" ? { name: typed.name, quantity: typed.quantity, price: typed.price, tax: { intra: null, supplyClass: "non_taxable" as const } } : typed;
      }),
      outcome: "draft" in step ? ("draft" as const) : "voided" in step ? ("voided" as const) : ("recorded" as const),
      ...("job" in step && pack.jobs ? { job: step.job } : {}),
      ...("paid" in step
        ? {
            payments: [
              {
                inDays: step.paid,
                ...("part" in step ? { amount: step.part } : {}),
                // US-ONB-33: how it was paid, with the transfer's or cheque's reference.
                method: step.method,
                ...(step.method !== "cash" ? { reference: vendorPaymentReference(country.country, step.method, Number(step.key.slice(4))) } : {}),
              },
            ],
          }
        : {}),
      ...("voided" in step ? { voidReason: step.voided } : {}),
    };
  });

  // US-ONB-30 (D-216): vendor credits at every stage, each a share of the bill it's against.
  const billRef = (key: BillKey) => pack.bills[key].ref;
  const creditLine = (key: BillKey, label: string, share: number) => {
    const line = pack.bills[key].lines[0]!;
    const scaled: IndustryFreeLine =
      line.quantity >= 10
        ? { ...line, name: `${label}: ${line.name}`, quantity: Math.max(1, Math.round(line.quantity * share)) }
        : { ...line, name: `${label}: ${line.name}`, price: Math.round(line.price * share * 100) / 100, in: { ...line.in, price: Math.round(line.in.price * share) } };
    const typed = freeLine(scaled);
    // A sole trader under the registration threshold charges no tax, anywhere (as on its bill).
    const vendor = BILL_TIMELINE.find((b) => b.key === key)!.vendor;
    return vendor === "local" ? { name: typed.name, quantity: typed.quantity, price: typed.price, tax: { intra: null, supplyClass: "non_taxable" as const } } : typed;
  };
  const vendorCredits = [
    // Partly used: raised against the overdue bill and part of it applied there.
    { contact: "supplier_far", vendorReference: `CN-${billRef("bill2").split("-").pop()}`, dateInDays: -20, againstBill: billRef("bill2"), lines: [creditLine("bill2", "Returned", 0.1)], outcome: "recorded" as const, apply: { inDays: -18, fraction: 0.6 } },
    // Unused for over 60 days: credit to use, or to ask back.
    { contact: "supplier", vendorReference: `CR-${billRef("bill1").split("-").pop()}`, dateInDays: -70, againstBill: billRef("bill1"), lines: [creditLine("bill1", "Overcharged", 0.05)], outcome: "recorded" as const },
    // Used: the sole trader paid it back.
    { contact: "local", vendorReference: `${billRef("bill3")}-R`, dateInDays: -30, againstBill: billRef("bill3"), lines: [creditLine("bill3", "Work not done", 0.1)], outcome: "recorded" as const, refundInDays: -25 },
    // A draft to record.
    { contact: "supplier", vendorReference: `CN-${billRef("bill5").split("-").pop()}`, dateInDays: -1, againstBill: billRef("bill5"), lines: [creditLine("bill5", "Short delivery", 0.1)], outcome: "draft" as const },
  ];
  const recurringBills = [{ contact: "services", name: pack.recurringBill.name, startsInDays: 5, dueDays: 14, lines: [freeLine(pack.recurringBill.line)] }];

  const expenses = EXPENSE_TIMELINE.map((step) => {
    const content = pack.expenses[step.key];
    const amount = price(content.amount, content.inAmount);
    const tax = country.expenseTax ? { rate: country.expenseTax.rate, amount: (amount * BigInt(Math.round(country.expenseTax.percent * 100)) + BigInt(Math.round((100 + country.expenseTax.percent) * 50))) / BigInt(Math.round((100 + country.expenseTax.percent) * 100)) } : undefined;
    return {
      category: content.category,
      amount,
      ...(tax ? { tax } : {}),
      paidBy: content.paidBy,
      description: content.description,
      dateInDays: step.date,
      outcome: step.outcome,
      ...("job" in step && pack.jobs ? { job: step.job } : {}),
      ...(step.outcome === "rejected" ? { rejectReason: "Over the meal limit in the expenses policy — resubmit the itemised receipt." } : {}),
      // US-ONB-31: every demo expense comes with its receipt.
      receipt: { merchant: receiptMerchant(content.category, content.description), place: country.business.place.city },
    };
  });

  const businessPlace = country.business.place;
  const businessAddress = `${businessPlace.line1}, ${businessPlace.city}, ${businessPlace.state} ${businessPlace.postalCode}`;
  return {
    country: country.country,
    industry: pack.industry,
    business: {
      name: businessName,
      address: businessAddress,
      industry: pack.label,
      email: `hello@${domain}`,
      phone: country.business.phone,
      ...(country.upiId ? { upiId: country.upiId, upiPayeeName: businessName } : {}),
    },
    currency: country.currency,
    financialYearStart: country.financialYearStart,
    template: pack.industry,
    taxCountry: country.taxCountry,
    ...(india && country.business.pan && businessPlace.stateCode
      ? {
          gstRegistration: {
            registrationNumber: demoGstin(businessPlace.stateCode, country.business.pan),
            legalName: pack.inLegalName,
            tradeName: businessName,
            stateCode: businessPlace.stateCode,
            registeredOn: "2019-04-01",
            returnPeriod: "monthly" as const,
            exportUnderLut: true,
          },
        }
      : {}),
    ownTaxRates: country.ownTaxRates ?? [],
    ownTaxGroups: [],
    ordering: "dated",
    contacts,
    items,
    quotes: [
      ...pack.quotes.map((q, i): DemoPlanQuote => ({
        contact: q.slot === "overseas" && !pack.exports ? "anchor" : q.slot,
        title: q.title,
        validUntilInDays: q.validUntilInDays,
        notes: q.notes,
        ...(q.terms ? { terms: q.terms } : {}),
        lines: lines(q.lines, q.slot),
        outcome: q.outcome,
        ...QUOTE_TIMELINE[i],
      })),
      // US-ONB-25: the lost tender's quote, declined.
      {
        contact: "regional",
        title: pack.lostLead.title,
        validUntilInDays: -5,
        notes: `${pack.lostLead.title} — our tender price.`,
        lines: lines(pack.lostLead.lines, "regional"),
        outcome: "declined",
        forLostLead: true,
        sentInDays: -35,
        views: { count: 2, lastInDays: -28 },
        respondedInDays: -21,
        comment: "Thanks — we've gone with a lower price this time.",
      },
    ],
    invoices,
    jobs,
    ...(pack.jobs && pack.variationOrder ? { variationOrder: { job: "a", notes: pack.variationOrder.notes, lines: pack.variationOrder.lines.map(freeLine) } } : {}),
    bills,
    vendorCredits,
    banking: demoBanking(country.country),
    vendorPayments: [
      {
        contact: SHARED_VENDOR_PAYMENT.vendor,
        bills: SHARED_VENDOR_PAYMENT.bills.map((key) => pack.bills[key].ref),
        inDays: SHARED_VENDOR_PAYMENT.inDays,
        method: "bank_transfer" as const,
        reference: vendorPaymentReference(country.country, "bank_transfer", 10),
        remittanceInDays: SHARED_VENDOR_PAYMENT.remittanceInDays,
      },
    ],
    recurringBills,
    // US-ONB-32: goods categories default to the rate expenses carry here; one category archived.
    ...(country.expenseTax ? { categoryTaxDefault: country.expenseTax.rate } : {}),
    archivedCategory: DEMO_ARCHIVED_CATEGORY,
    expenses,
    // US-ONB-29 (D-219): one only off its invoice, one whose spare credit was partly applied to the customer's
    // overdue invoice (the rest still to use), and one whose spare credit was refunded — each crediting lines with their tax.
    creditNotes: [
      { invoice: "inv13", reason: pack.creditNote.reason, lines: [{ line: pack.creditNote.line, quantity: pack.creditNote.quantity }], issuedInDays: -3 },
      { invoice: "inv01", reason: "Agreed reduction on finished work — credit kept against the next invoice.", lines: [{ line: 0, quantity: 1 }], issuedInDays: -9, applyInDays: -7 },
      { invoice: "inv12", reason: "Charged for work that wasn't needed — refunded to the customer.", lines: [{ line: 0, quantity: 1 }], issuedInDays: -1, refundInDays: 0 },
    ],
    meetings: [
      ...pack.meetings.map((m, i) => {
        const contact = m.slot ? contacts.find((c) => c.key === m.slot) : undefined;
        return {
          title: m.title,
          contact: contact ? contact.key : null,
          startInDays: m.startInDays,
          startTime: MEETING_TIMES[i % MEETING_TIMES.length],
          durationHours: m.durationHours,
          location: m.atSite && contact ? `${contact.address.line1}, ${contact.address.city}` : null,
          description: m.description,
          ...(m.weekly ? { weeklyFor: WEEKLY_MEETINGS } : {}),
        };
      }),
      // US-ONB-27: one more in the coming weeks, with the SEZ customer's open lead.
      { title: `Scoping meeting — ${pack.leads.sez.title}`, contact: "sez", startInDays: 8, startTime: "14:00", durationHours: 1, location: null, description: "Agree the scope and dates before we quote." },
    ],
    bundles: pack.bundles,
  };
}
