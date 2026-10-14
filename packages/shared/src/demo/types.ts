import type { LostReason } from "../schemas/contacts.ts";
import type { IndustryTemplateValue } from "../schemas/industry-template.ts";
import type { GstTreatment } from "../tax/gst.ts";
import type { TaxCountry } from "../tax/presets/types.ts";
import type { SupplyClass } from "../tax/supply-class.ts";

/** US-ONB-18 (D-192) — the countries a demo business can be in; the United States is the default. */
export const DEMO_COUNTRIES = ["US", "IN", "GB", "AU", "NZ", "AE", "SA"] as const;
export type DemoCountry = (typeof DEMO_COUNTRIES)[number];

/** The industries a demo business can be in; each uses the industry template of the same name. */
export const DEMO_INDUSTRIES = ["construction", "interior_design", "trades", "it_services", "professional_services"] as const;
export type DemoIndustry = (typeof DEMO_INDUSTRIES)[number] & IndustryTemplateValue;

export const DEMO_COUNTRY_LABELS: Record<DemoCountry, string> = {
  US: "United States (sales tax)",
  IN: "India (GST)",
  GB: "United Kingdom (VAT)",
  AU: "Australia (GST)",
  NZ: "New Zealand (GST)",
  AE: "United Arab Emirates (VAT)",
  SA: "Saudi Arabia (VAT)",
};

/** The tax country each demo country sets (US-TAX-09); the United States has no preset. */
export const DEMO_TAX_COUNTRY: Record<DemoCountry, TaxCountry> = { US: "other", IN: "IN", GB: "GB", AU: "AU", NZ: "NZ", AE: "AE", SA: "SA" };

/** The demo country for a business's tax country: "Other" or none is the United States. */
export function demoCountryFor(taxCountry: string | null | undefined): DemoCountry {
  return (DEMO_COUNTRIES as readonly string[]).includes(taxCountry ?? "") && taxCountry !== "US" ? (taxCountry as DemoCountry) : "US";
}

export const DEMO_DEFAULT = { country: "US", industry: "construction" } as const satisfies { country: DemoCountry; industry: DemoIndustry };

export const DEMO_COUNTRY_LOCKED = "DEMO_COUNTRY_LOCKED";
export const DEMO_DATA_LOADED = "DEMO_DATA_LOADED";
export const DEMO_DATA_LOADED_MESSAGE = "Demo data is already loaded. Delete it first to load another demo business.";
/** "Your business already has its own records, so demo data uses its country: India (GST)." */
export const demoCountryLockedMessage = (country: DemoCountry) => `Your business already has its own records, so demo data uses its country: ${DEMO_COUNTRY_LABELS[country]}.`;
/** The note under a fixed Country in the picker. */
export const demoCountryFixedNote = (country: DemoCountry) => `Demo data uses your business's country: ${DEMO_COUNTRY_LABELS[country]}.`;

/** `GET /demo-data/status`. */
export interface DemoDataStatus {
  hasDemoData: boolean;
  /** Which demo is loaded; null for none, or for one loaded before US-ONB-18. */
  loaded: { country: DemoCountry; industry: DemoIndustry; businessName: string } | null;
  /** The business's own country for demos (its tax country), or null when it has none. */
  country: DemoCountry | null;
  /** True once the business has records of its own: only the industry can be chosen. */
  countryLocked: boolean;
}

/* ------------------------------------------------------------------ */
/* The plan: everything one demo business is, as data. The API's seeder */
/* runs it through the real services (DemoDataService).                 */
/* ------------------------------------------------------------------ */

/** A tax by the name the country's preset (or the demo itself) gives it. */
export interface DemoTaxRef {
  rate?: string;
  group?: string;
}

/** An item's or line's tax: within the state (or anywhere outside India) and, in India, across states. Null is no tax. */
export interface DemoTax {
  intra: DemoTaxRef | null;
  inter?: DemoTaxRef | null;
  /** Why a line has no tax (US-TAX-11); a taxed line is taxable. */
  supplyClass?: SupplyClass;
}

export interface DemoPlanContact {
  key: string;
  type: "customer" | "vendor" | "both";
  isCompany: boolean;
  name: string;
  email: string;
  phone: string;
  taxId?: string;
  website?: string;
  gstTreatment?: GstTreatment;
  /** Two-digit GST state (India). */
  stateCode?: string;
  person: { name: string; title: string; email: string; phone: string };
  address: { line1: string; city: string; state: string; stateCode?: string; postalCode: string; country: string };
  lead?: DemoPlanLead;
  activity?: { type: "call" | "meeting" | "note" | "task"; notes: string; dueInDays: number };
  /** US-ONB-24 — a second lead on the same contact (a tender lost on price). */
  lostLead?: DemoPlanLead;
}

/** A lead, with how it's being worked (US-ONB-24, D-216). */
export interface DemoPlanLead {
  stage: "new" | "qualified" | "proposal" | "won" | "lost";
  value: bigint;
  title: string;
  source: string;
  /** Who it belongs to: the person loading the demo, or the demo Staff person. */
  owner?: "owner" | "staff";
  /** Days since it moved into its stage (or was closed). */
  daysInStage?: number;
  /** Open leads: when it's expected to close. */
  expectedCloseInDays?: number;
  /** The one open lead with no activity for 14 days and more. */
  cold?: boolean;
  lostReason?: LostReason;
  lostNote?: string;
}

export interface DemoPlanItem {
  key: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  /** Minor units of the plan's currency. */
  price: bigint;
  tax: DemoTax;
  hsnSac?: string;
  /** US-ONB-27 — goods post to 4000 Sales — Goods; services keep the default (4100). */
  income?: "goods" | "services";
}

/** US-ONB-27 — a bundle made from catalogue items. */
export interface DemoPlanBundle {
  name: string;
  description: string;
  items: [item: string, quantity: number][];
}

/** A line from a catalogue item, or one typed in (bills, variation orders). */
export type DemoPlanLine =
  | { item: string; quantity: number; discount?: number; /** Instead of the item's own tax (an export outside India). */ tax?: DemoTax }
  | { name: string; description?: string; quantity: number; price: bigint; tax: DemoTax | null; hsnSac?: string };

export interface DemoPlanPayment {
  /** Days from today (negative is past); null is today. */
  inDays: number | null;
  /** "full" or a fraction of the total. */
  amount: "full" | number;
  method?: "bank_transfer" | "upi" | "card" | "cheque" | "cash";
}

export interface DemoPlanInvoice {
  key: string;
  contact: string;
  /** Days from today; null leaves the issue date to the day it's issued (today). */
  issueInDays: number | null;
  dueInDays: number;
  notes?: string;
  lines: DemoPlanLine[];
  outcome: "draft" | "issued" | "voided";
  payments?: DemoPlanPayment[];
  voidReason?: string;
  /** India: lines carry no tax and are zero-rated, changed by hand (an SEZ supply under LUT, D-181). */
  zeroRated?: boolean;
  /** US-ONB-28 — days from today it was emailed to the customer, and a reminder sent (null is today). */
  emailedInDays?: number | null;
  remindedInDays?: number | null;
}

export interface DemoPlanQuote {
  contact: string;
  /** US-ONB-25 */
  title: string;
  validUntilInDays: number;
  notes?: string;
  terms?: string;
  lines: DemoPlanLine[];
  /** "revised" sends it, then sends a revision too (US-QUO-22); "accepted" and "declined" are answered through the customer's link. */
  outcome: "draft" | "sent" | "revised" | "accepted" | "declined";
  /** Days from today it was sent (a revised quote's first version; its revision goes out `revisedInDays`). */
  sentInDays?: number;
  revisedInDays?: number;
  /** The customer's views of the link: how many, and the last one's day. */
  views?: { count: number; lastInDays: number };
  /** Accepted or declined that day (kept within this month for an acceptance meant to count as "Won this month"). */
  respondedInDays?: number;
  thisMonth?: boolean;
  comment?: string;
  /** For the contact's lost lead rather than its main one. */
  forLostLead?: boolean;
}

export interface DemoPlanMilestone {
  name: string;
  amountType: "fixed" | "percent";
  amount: number;
  dueInDays: number;
  /** When set, the milestone is completed and invoiced, and the invoice issued, that day (null: today). */
  invoiceInDays?: number | null;
  /** Paid this many days after its invoice ("full"), when set. */
  paidAfterDays?: number;
  /** US-ONB-26 — completed that day and left for the office to invoice (null: today). */
  completeInDays?: number | null;
}

export interface DemoPlanJob {
  key: string;
  contact: string;
  name: string;
  siteAddress: string;
  contractValue: bigint;
  retentionPct: number;
  startInDays: number;
  milestones: DemoPlanMilestone[];
  /** Release retention today, after every milestone is invoiced. */
  releaseRetention?: boolean;
  /** Tax and HSN/SAC for its milestone invoices; Riverstone's have none. */
  milestoneTax?: { tax: DemoTax; hsnSac?: string };
  note: string;
  photoCaption: string;
  /** US-ONB-26 */
  endInDays: number;
  /** A cost budget: near what the job has cost so far, or a share of the contract. */
  budget?: "near" | number;
  percentComplete?: number;
  /** Marked completed once its milestones are billed. */
  completed?: boolean;
  /** US-ONB-25 — made from an accepted contract quote: one lump-sum line at the contract value. */
  fromQuote?: { title: string; sentInDays: number; respondedInDays: number; viewedInDays: number };
}

export interface DemoPlanVariationOrder {
  job: string;
  notes: string;
  lines: Extract<DemoPlanLine, { name: string }>[];
}

export interface DemoPlanBill {
  contact: string;
  billNumber: string;
  dateInDays: number;
  dueInDays: number | null;
  lines: Extract<DemoPlanLine, { name: string }>[];
  outcome: "draft" | "recorded" | "voided";
  job?: string;
  /** Full unless `amount` is a fraction of the total (US-ONB-30: a partly paid bill); by bank transfer unless `method` says (US-ONB-33). */
  payments?: { inDays: number | null; amount?: "full" | number; method?: DemoVendorPaymentMethod; reference?: string }[];
  voidReason?: string;
}

export type DemoVendorPaymentMethod = "bank_transfer" | "cheque" | "cash";

/** US-ONB-33 — one vendor payment paying several plan bills (by number) in full, with its remittance advice emailed on a day. */
export interface DemoPlanVendorPayment {
  contact: string;
  bills: string[];
  inDays: number;
  method: DemoVendorPaymentMethod;
  reference?: string;
  remittanceInDays?: number;
}

/** US-ONB-30 — a vendor credit, by the bill it's against (its number). */
export interface DemoPlanVendorCredit {
  contact: string;
  vendorReference: string;
  dateInDays: number;
  againstBill?: string;
  lines: Extract<DemoPlanLine, { name: string }>[];
  outcome: "draft" | "recorded";
  /** Applied to its bill on that day, this fraction of the credit. */
  apply?: { inDays: number; fraction: number };
  /** Refunded in full by the vendor on that day. */
  refundInDays?: number;
}

/** US-ONB-30 — a monthly recurring bill; it starts in the future, so it hasn't run yet. */
export interface DemoPlanRecurringBill {
  contact: string;
  name: string;
  startsInDays: number;
  dueDays: number;
  lines: Extract<DemoPlanLine, { name: string }>[];
}

export interface DemoPlanExpense {
  /** An expense category the industry template sets up. */
  category: string;
  /** Total paid, tax included. */
  amount: bigint;
  /** Input tax inside `amount`, with the rate it's at. */
  tax?: { rate: DemoTaxRef; amount: bigint };
  paidBy: "company" | "employee";
  description: string;
  dateInDays: number;
  outcome: "submitted" | "approved" | "rejected";
  job?: string;
  rejectReason?: string;
  /** US-ONB-31 — a receipt the demo prints for it: the shop and its town. */
  receipt?: { merchant: string; place: string };
}

export interface DemoPlanCreditNote {
  invoice: string;
  reason: string;
  /** Which invoice line (by position) and how many to credit. */
  lines: { line: number; quantity: number }[];
  /** US-ONB-29 — days from today it was issued (kept within this month; null or absent is today). */
  issuedInDays?: number | null;
  /** Half of its spare credit applied to the customer's other open invoices that day (null is today). */
  applyInDays?: number | null;
  /** What's left of its spare credit refunded to the customer that day (null is today). */
  refundInDays?: number | null;
}

export interface DemoPlanMeeting {
  title: string;
  contact: string | null;
  startInDays: number;
  /** US-ONB-27 — local start time, "14:30" (9:00 when unset). */
  startTime?: string;
  durationHours: number;
  location: string | null;
  description: string | null;
}

export interface DemoPlan {
  country: DemoCountry;
  industry: DemoIndustry;
  business: { name: string; address: string; industry: string; email?: string; phone?: string; upiId?: string; upiPayeeName?: string };
  currency: { code: string; locale: string };
  financialYearStart: { month: number; day: number };
  template: IndustryTemplateValue;
  taxCountry: TaxCountry;
  /** India: the business's GST registration (US-TAX-12) and export setting (D-181). */
  gstRegistration?: { registrationNumber: string; legalName: string; tradeName: string; stateCode: string; registeredOn: string; returnPeriod: "monthly" | "quarterly"; exportUnderLut: boolean };
  /** Rates and groups the demo adds itself, for a country without a preset. `useDefaultRate` takes the business's default tax rate when it has one. */
  ownTaxRates: { name: string; rate: number; isCompound?: boolean; useDefaultRate?: boolean }[];
  ownTaxGroups: { name: string; rates: string[] }[];
  /** "dated" runs every dated step in date order, so numbers follow dates; Riverstone keeps its "declared" order. */
  ordering: "declared" | "dated";
  contacts: DemoPlanContact[];
  items: DemoPlanItem[];
  quotes: DemoPlanQuote[];
  invoices: DemoPlanInvoice[];
  jobs: DemoPlanJob[];
  variationOrder?: DemoPlanVariationOrder;
  bills: DemoPlanBill[];
  vendorCredits: DemoPlanVendorCredit[];
  /** US-ONB-33 — payments across several bills. */
  vendorPayments?: DemoPlanVendorPayment[];
  /** US-ONB-34 — a card, transfers, money in and out, a statement and reconciliations. */
  banking?: DemoPlanBanking;
  recurringBills: DemoPlanRecurringBill[];
  /**
   * US-ONB-32 (D-228) — the rate the template's goods categories default to
   * (a business without records of its own only); absent where expenses
   * carry no tax.
   */
  categoryTaxDefault?: DemoTaxRef;
  /** US-ONB-32 — a category the demo adds archived, so the Archived filter shows something. */
  archivedCategory: { name: string; description: string };
  expenses: DemoPlanExpense[];
  creditNotes: DemoPlanCreditNote[];
  meetings: DemoPlanMeeting[];
  bundles: DemoPlanBundle[];
}

/**
 * US-ONB-34 (D-231) — the demo's banking: a credit card with spending on it
 * and a payoff, a petty cash top-up, interest and bank charges, and the
 * bank's statement for last month (reconciled on the 3rd) and this month
 * (in progress, with a charge not yet in Spine). Amounts in minor units.
 */
export interface DemoPlanBanking {
  card: { name: string; bankName: string; last4: string };
  /** On the card: a subscription about 40 days ago (paid off a week later) and fuel last week. */
  cardSpend: [bigint, bigint];
  pettyCash: bigint;
  interest: bigint;
  bankCharges: bigint;
  /** On this month's statement only: to Create or exclude. */
  smsCharges: bigint;
}
