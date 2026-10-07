import { Inject, Injectable } from "@nestjs/common";
import { placeOfSupplyFor, supplyTypeFor, type SupplyType, type TaxProfile } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { addresses, contacts, settings } from "../../db/schema";

export interface PlaceOfSupply {
  placeOfSupply: string | null;
  supplyType: SupplyType | null;
}

/**
 * US-TAX-13 (D-146) — a document's GST place of supply and supply type.
 * The place of supply is the one given, else the contact's (site or
 * shipping address, else billing, else the contact's state, "96" for an
 * overseas customer). The supply type compares it with the business's
 * state; it's null outside India or without a GST state.
 */
@Injectable()
export class PlaceOfSupplyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * `given` undefined means "use the contact's default"; null clears it.
   * A sale to an overseas customer is an export; a purchase from one is
   * inter-state.
   */
  async resolve(orgId: string, contactId: string, given: string | null | undefined, direction: "sale" | "purchase", tx: Transaction | Database = this.db): Promise<PlaceOfSupply> {
    const [profileRow] = await tx.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "tax_profile")));
    const profile = (profileRow?.value ?? {}) as TaxProfile;
    if (profile.country !== "IN") return { placeOfSupply: given ?? null, supplyType: null };
    const [contact] = await tx.select({ gstTreatment: contacts.gstTreatment, stateCode: contacts.stateCode }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    let placeOfSupply = given ?? null;
    if (given === undefined && contact) {
      const contactAddresses = await tx.select({ type: addresses.type, stateCode: addresses.stateCode, isPrimary: addresses.isPrimary }).from(addresses).where(eq(addresses.contactId, contactId));
      placeOfSupply = placeOfSupplyFor({ ...contact, addresses: contactAddresses })?.code ?? null;
    }
    const supplyType = supplyTypeFor({ businessState: typeof profile.stateCode === "string" ? profile.stateCode : null, placeOfSupply, treatment: contact?.gstTreatment, direction });
    return { placeOfSupply, supplyType };
  }
}
