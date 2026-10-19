import type { DocumentSuggestion } from "@spine/shared";
import { blankLine, type EditableVendorBillLine } from "./vendor-bill-line-editor";

/** The bill's header fields AI can fill (US-AI-08). */
export type BillField = "vendor" | "billNumber" | "currency" | "date" | "dueDate" | "placeOfSupply";

export interface BillHeader {
  contactId: string;
  billNumber: string;
  currency: string;
  date: Date | undefined;
  dueDate: Date | undefined;
  placeOfSupply: string | null;
}

export interface BillFill {
  /** Values for fields the person hasn't entered. */
  header: Partial<BillHeader>;
  filled: BillField[];
  /** Fields the person entered where AI read something else — offered by "Replace my entries". */
  kept: Partial<BillHeader>;
  /** The lines to put in when the bill has none yet; else null. */
  lines: EditableVendorBillLine[] | null;
  /** AI's lines when the person already has some — offered by "Replace my entries". */
  keptLines: EditableVendorBillLine[] | null;
  /** How many of the person's entries "Replace my entries" would change. */
  replaceCount: number;
  /** A vendor name that matches none of the business's vendors — offered, never added by itself. */
  newVendor: string | null;
}

const FIELD_OF: Record<keyof BillHeader, BillField> = { contactId: "vendor", billNumber: "billNumber", currency: "currency", date: "date", dueDate: "dueDate", placeOfSupply: "placeOfSupply" };

/** A row nobody has typed in. */
export function isBlankLine(line: EditableVendorBillLine): boolean {
  return !line.name.trim() && !line.description.trim() && line.unitPriceAmount === 0n && !line.catalogItemId;
}

/** The suggestion's lines as bill rows — totals come from Spine's own maths when they show. */
export function suggestionLines(suggestion: DocumentSuggestion): EditableVendorBillLine[] {
  return suggestion.lines.map((line) => ({
    ...blankLine(),
    catalogItemId: line.catalogItemId,
    name: line.name,
    description: line.description ?? "",
    quantity: line.quantity,
    unitPriceAmount: BigInt(line.unitPriceAmount),
    accountId: line.accountId,
    taxRateId: line.taxRateId,
    taxGroupId: line.taxGroupId,
    taxRatePercentage: 0,
    isTaxInclusive: line.isTaxInclusive,
    supplyClass: line.taxRateId || line.taxGroupId ? "taxable" : "zero_rated",
    hsnSac: line.hsnSac ?? "",
  }));
}

const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) : a === b);

/**
 * The shared rules for the bill page (D-242) — AI fills the fields the
 * person hasn't entered (today's date and the default currency aren't
 * entries) and offers the rest as "Replace my entries (<n>)". Lines go in
 * when the bill has none yet. Run it on the values as they are when the
 * answer arrives, so anything typed meanwhile stays (US-AI-07).
 */
export function planBillFill(current: BillHeader & { lines: EditableVendorBillLine[] }, entered: ReadonlySet<BillField>, suggestion: DocumentSuggestion): BillFill {
  const read: Partial<BillHeader> = {
    contactId: suggestion.vendor?.contactId ?? undefined,
    billNumber: suggestion.number ?? undefined,
    currency: suggestion.currency ?? undefined,
    date: suggestion.date ? new Date(suggestion.date) : undefined,
    dueDate: suggestion.dueDate ? new Date(suggestion.dueDate) : undefined,
    placeOfSupply: suggestion.placeOfSupply ?? undefined,
  };
  const header: Partial<BillHeader> = {};
  const kept: Partial<BillHeader> = {};
  const filled: BillField[] = [];
  for (const key of Object.keys(read) as (keyof BillHeader)[]) {
    const value = read[key];
    if (value === undefined) continue;
    const field = FIELD_OF[key];
    const mine = current[key];
    if (!entered.has(field) || mine === "" || mine === undefined || mine === null) {
      (header as Record<string, unknown>)[key] = value;
      filled.push(field);
    } else if (!same(mine, value)) {
      (kept as Record<string, unknown>)[key] = value;
    }
  }
  const aiLines = suggestionLines(suggestion);
  const mine = current.lines.filter((l) => !isBlankLine(l));
  const lines = aiLines.length && !mine.length ? aiLines : null;
  const keptLines = aiLines.length && mine.length ? aiLines : null;
  const vendorEntered = entered.has("vendor") && Boolean(current.contactId);
  return {
    header,
    filled,
    kept,
    lines,
    keptLines,
    replaceCount: Object.keys(kept).length + (keptLines ? mine.length : 0),
    newVendor: suggestion.vendor && !suggestion.vendor.contactId && !vendorEntered ? suggestion.vendor.name : null,
  };
}
