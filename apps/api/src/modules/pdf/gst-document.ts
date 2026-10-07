import { and, eq, inArray } from "drizzle-orm";
import { gstinRequired, legacyGstRates, splitLineTax, type SupplyType, type TaxComponent, type TaxProfile, type TaxType } from "@spine/shared";
import type { Database } from "../../db/client";
import { addresses, contacts, settings, taxGroupRates, taxRates } from "../../db/schema";

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
  const rateIds = [...new Set(items.map((l) => l.taxRateId).filter((id): id is string => Boolean(id)))];
  const groupIds = [...new Set(items.map((l) => l.taxGroupId).filter((id): id is string => Boolean(id)))];
  const links = groupIds.length ? await db.select().from(taxGroupRates).where(inArray(taxGroupRates.taxGroupId, groupIds)) : [];
  const allRateIds = [...new Set([...rateIds, ...links.map((l) => l.taxRateId)])];
  const rateRows = allRateIds.length ? await db.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, allRateIds))) : [];
  const rateOf = (id: string) => rateRows.find((r) => r.id === id);
  const asGst = (type: TaxType): TaxType => (type === "other" || type === "vat" || type === "gst" || type === "sales_tax" ? (doc.supplyType === "intra" ? "cgst" : "igst") : type);

  const lineTaxes: Record<string, TaxComponent[]> = {};
  for (const line of items) {
    let rates: { taxType: TaxType; rate: number }[];
    if (line.taxRateId && rateOf(line.taxRateId)) {
      const r = rateOf(line.taxRateId)!;
      rates = r.taxType === "other" ? legacyGstRates(r.rate, doc.supplyType) : [{ taxType: asGst(r.taxType), rate: r.rate }];
    } else if (line.taxGroupId) {
      rates = links.filter((l) => l.taxGroupId === line.taxGroupId).flatMap((l) => (rateOf(l.taxRateId) ? [{ taxType: asGst(rateOf(l.taxRateId)!.taxType), rate: rateOf(l.taxRateId)!.rate }] : []));
    } else {
      rates = legacyGstRates(line.taxRatePercentage, doc.supplyType);
    }
    lineTaxes[line.id] = splitLineTax(line.lineTaxAmount, rates);
  }

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
