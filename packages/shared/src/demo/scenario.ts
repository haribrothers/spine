import { gstinCheckCharacter } from "../tax/gst.ts";
import type { GstTreatment } from "../tax/gst.ts";
import type { TaxCountry } from "../tax/presets/types.ts";
import type { DemoCountry, DemoIndustry, DemoPlan, DemoPlanContact, DemoPlanLine, DemoPlanMilestone, DemoTax, DemoTaxRef } from "./types.ts";

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
  quotes: { slot: CustomerSlot; validUntilInDays: number; notes: string; terms?: string; lines: IndustryLine[]; outcome: "draft" | "sent" | "revised" }[];
  /** Lines and notes for each invoice of the timeline, by key. */
  invoices: Record<InvoiceKey, { notes: string; lines: IndustryLine[] }>;
  jobs?: { a: IndustryJob; b: IndustryJob; c: IndustryJob; releaseRetention: boolean };
  variationOrder?: { notes: string; lines: IndustryFreeLine[] };
  vendors: Record<VendorSlot, { name: string; inName: string; title: string; type?: "vendor" | "both" }>;
  bills: Record<BillKey, { ref: string; lines: IndustryFreeLine[] }>;
  expenses: Record<ExpenseKey, { category: string; amount: number; inAmount: number; description: string; paidBy: "company" | "employee" }>;
  creditNote: { reason: string; line: number; quantity: number };
  meetings: { title: string; slot: CustomerSlot | null; startInDays: number; durationHours: number; atSite: boolean; description: string | null }[];
}

/** The six-month timeline every industry shares. Payments are full unless a fraction is given. */
export const INVOICE_TIMELINE = [
  { key: "inv01", slot: "anchor", issue: -165, due: -135, paid: [[-150, "full"]] },
  { key: "inv02", slot: "consumer", issue: -140, due: -126, paid: [[-136, "full"]] },
  { key: "inv03", slot: "regional", issue: -118, due: -88, paid: [[-92, "full"]] },
  { key: "inv04", slot: "institution", issue: -96, due: -66, paid: [[-70, "full"]] },
  { key: "inv05", slot: "sez", issue: -74, due: -44, paid: [[-50, "full"]] },
  { key: "inv06", slot: "anchor", issue: -58, due: -28, paid: [[-35, 0.5]] },
  // Raised by mistake and voided the same day: a void posts on the day it's made (D-185), so an earlier
  // invoice voided today would put this month's Tax Summary out of step with this month's GSTR-1.
  { key: "inv07", slot: "institution", issue: null, due: 30, voided: "Raised against the wrong purchase order — reissued." },
  { key: "inv08", slot: "regional", issue: -26, due: -11 },
  // India: an SEZ supply under LUT, zero-rated by hand (SEWOP); the earlier one carried IGST (SEWP).
  { key: "inv09", slot: "sez", issue: -22, due: 8, zeroRatedInIndia: true },
  { key: "inv10", slot: "overseas", issue: -18, due: 12, paid: [[-4, "full"]] },
  { key: "inv11", slot: "consumer_far", issue: -12, due: 2, paid: [[-5, 0.4]] },
  { key: "inv12", slot: "consumer", issue: -8, due: 6, paid: [[-2, "full"]] },
  { key: "inv13", slot: "anchor", issue: -6, due: 24 },
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
}[];
export type InvoiceKey = (typeof INVOICE_TIMELINE)[number]["key"];

export const BILL_TIMELINE = [
  { key: "bill1", vendor: "supplier", date: -150, due: -120, paid: -125 },
  { key: "bill2", vendor: "supplier_far", date: -60, due: -30 },
  { key: "bill3", vendor: "local", date: -40, due: -40, paid: -38 },
  { key: "bill4", vendor: "services", date: -90, due: -60, voided: "Entered twice — the vendor's statement shows one charge." },
  { key: "bill5", vendor: "supplier", date: -10, due: 20, job: "a" },
  { key: "bill6", vendor: "supplier_far", date: -3, due: 27, draft: true },
] as const satisfies readonly { key: string; vendor: VendorSlot; date: number; due: number; paid?: number; voided?: string; draft?: boolean; job?: "a" | "b" | "c" }[];
export type BillKey = (typeof BILL_TIMELINE)[number]["key"];

export const EXPENSE_TIMELINE = [
  { key: "exp1", date: -120, outcome: "approved" },
  { key: "exp2", date: -60, outcome: "approved" },
  { key: "exp3", date: -25, outcome: "approved", job: "a" },
  { key: "exp4", date: -4, outcome: "submitted" },
  { key: "exp5", date: -15, outcome: "rejected" },
] as const satisfies readonly { key: string; date: number; outcome: "approved" | "submitted" | "rejected"; job?: "a" }[];
export type ExpenseKey = (typeof EXPENSE_TIMELINE)[number]["key"];

/**
 * Job A has just started, its first milestone due this week (so the field
 * app's Today has a job, US-MOB-03); B is half invoiced; C is finished.
 * Milestone invoices are paid after the days given.
 */
const JOB_TIMELINE = {
  a: { start: -10, due: [4, 35, 60], invoice: [undefined, undefined, undefined], paidAfter: [undefined, undefined, undefined] },
  b: { start: -80, due: [-64, -20, 20], invoice: [-64, -20, undefined], paidAfter: [20, undefined, undefined] },
  c: { start: -170, due: [-160, -130, -100], invoice: [-160, -130, -100], paidAfter: [15, 20, 25] },
} as const;

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
      lead: { stage: lead.stage, value: price(lead.value, Math.round((lead.value * 30) / 1000) * 1000), title: lead.title, source: lead.source },
      activity: lead.activity,
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
            ...(timing.paidAfter[i] !== undefined ? { paidAfterDays: timing.paidAfter[i] } : {}),
          })),
          // Not in India: GSTR-1 would count a retention-release invoice as a supply of its own (Q-21).
          releaseRetention: key === "c" && pack.jobs!.releaseRetention && job.retentionPct > 0 && !india,
          milestoneTax: india ? { tax: gstTax(18), hsnSac: job.sac } : { tax: countryTax(country, "standard", false) ?? { intra: null, supplyClass: "zero_rated" as const } },
          note: `Kick-off on site at ${siteAddress}. Crew and dates follow the milestones below.`,
          photoCaption: "Site at kick-off.",
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
      ...("paid" in step ? { payments: [{ inDays: step.paid }] } : {}),
      ...("voided" in step ? { voidReason: step.voided } : {}),
    };
  });

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
    quotes: pack.quotes.map((q) => ({ contact: q.slot === "overseas" && !pack.exports ? "anchor" : q.slot, validUntilInDays: q.validUntilInDays, notes: q.notes, ...(q.terms ? { terms: q.terms } : {}), lines: lines(q.lines, q.slot), outcome: q.outcome })),
    invoices,
    jobs,
    ...(pack.jobs && pack.variationOrder ? { variationOrder: { job: "a", notes: pack.variationOrder.notes, lines: pack.variationOrder.lines.map(freeLine) } } : {}),
    bills,
    expenses,
    creditNotes: [{ invoice: "inv13", reason: pack.creditNote.reason, lines: [{ line: pack.creditNote.line, quantity: pack.creditNote.quantity }] }],
    meetings: pack.meetings.map((m) => {
      const contact = m.slot ? contacts.find((c) => c.key === m.slot) : undefined;
      return {
        title: m.title,
        contact: contact ? contact.key : null,
        startInDays: m.startInDays,
        durationHours: m.durationHours,
        location: m.atSite && contact ? `${contact.address.line1}, ${contact.address.city}` : null,
        description: m.description,
      };
    }),
  };
}
