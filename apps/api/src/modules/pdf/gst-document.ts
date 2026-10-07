import { and, eq } from "drizzle-orm";
import { gstinRequired, type SupplyType, type TaxComponent, type TaxProfile } from "@spine/shared";
import type { Database } from "../../db/client";
import { addresses, contacts, settings } from "../../db/schema";
import { RateBook } from "../tax/line-tax-components";

/** What a GST invoice or credit note prints beyond an ordinary one (US-TAX-15). */
export interface GstPdfContext {
  business: { gstin: string | null; stateCode: string | null; legalName: string | null };
  customer: { gstin: string | null; address: string | null; country: string | null };
  placeOfSupply: string | null;
  supplyType: SupplyType;
  /** D-181 — exports go out under LUT, without IGST. */
  exportUnderLut: boolean;
  /** Each item line's tax, split into CGST/SGST/UTGST/IGST/cess. */
  lineTaxes: Record<string, TaxComponent[]>;
  /** Every item line is exempt or non-taxable: a Bill of Supply, not a Tax Invoice. */
  billOfSupply: boolean;
}

interface GstLine {
  id: string;
  type: string;
  /** Absent on credit-note lines, which keep only the percentage. */
  taxRateId?: string | null;
  taxGroupId?: string | null;
  taxRatePercentage: number;
  lineTaxAmount: bigint;
  supplyClass: string | null;
}

/** The contact's billing address (else any), on one line. */
function oneLine(address: typeof addresses.$inferSelect | undefined): string | null {
  if (!address) return null;
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(" ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join(", ") || null;
}

/**
 * Loads the GST details for a document: null unless it has a supply type
 * (D-146 — an Indian business with a GST state). Rates are read now, which
 * is when the PDF is rendered — at issue for an issued document (D-083).
 */
export async function loadGstContext(
  db: Database,
  orgId: string,
  doc: { contactId: string; placeOfSupply: string | null; supplyType: SupplyType | null },
  lines: readonly GstLine[],
): Promise<GstPdfContext | null> {
  if (!doc.supplyType) return null;
  const [profileRow] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "tax_profile")));
  const profile = (profileRow?.value ?? {}) as TaxProfile;
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, doc.contactId)));
  const contactAddresses = contact ? await db.select().from(addresses).where(eq(addresses.contactId, contact.id)) : [];
  const billing = contactAddresses.find((a) => a.type === "billing" && a.isPrimary) ?? contactAddresses.find((a) => a.type === "billing") ?? contactAddresses[0];

  const items = lines.filter((l) => l.type === "item");
  const book = await RateBook.load(db, orgId, items);
  const lineTaxes: Record<string, TaxComponent[]> = {};
  for (const line of items) lineTaxes[line.id] = book.components(line, doc.supplyType);

  return {
    business: {
      gstin: typeof profile.registrationNumber === "string" ? profile.registrationNumber : null,
      stateCode: typeof profile.stateCode === "string" ? profile.stateCode : null,
      legalName: typeof profile.legalName === "string" ? profile.legalName : null,
    },
    customer: {
      gstin: contact && gstinRequired(contact.gstTreatment) ? contact.taxId : null,
      address: oneLine(billing),
      country: billing?.country ?? null,
    },
    placeOfSupply: doc.placeOfSupply,
    supplyType: doc.supplyType,
    exportUnderLut: profile.exportUnderLut === true,
    lineTaxes,
    billOfSupply: items.length > 0 && items.every((l) => l.supplyClass === "exempt" || l.supplyClass === "non_taxable"),
  };
}
