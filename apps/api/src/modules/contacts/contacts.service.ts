import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { addressInputSchema, contactPersonInputSchema, createContactSchema, updateContactSchema } from "@spine/shared";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { addresses, contactPersons, contacts, journalLines } from "../../db/schema";

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
type ContactPersonInput = z.infer<typeof contactPersonInputSchema>;
type AddressInput = z.infer<typeof addressInputSchema>;

/**
 * Contacts CRUD, including nested contact-persons/addresses. Nested data is
 * managed as a full-replace array on the contact's own create/update
 * payload (see packages/shared/src/schemas/contacts.ts's comment) — every
 * write to a contact deletes and re-inserts its persons/addresses inside
 * one transaction, rather than diffing. Simpler to reason about correctly
 * for a small, bounded per-contact list; the tradeoff (losing person/
 * address `id` stability across edits when the client omits `id`) is
 * acceptable since nothing else references a contact_person/address row by
 * id today.
 */
@Injectable()
export class ContactsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string, options: { type?: "customer" | "vendor" | "both"; search?: string; includeArchived?: boolean }) {
    const conditions = [eq(contacts.orgId, orgId)];
    if (options.type) {
      conditions.push(eq(contacts.type, options.type));
    }
    let rows = await this.db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(asc(contacts.name));

    if (!options.includeArchived) {
      rows = rows.filter((row) => row.archivedAt === null);
    }
    if (options.search) {
      const needle = options.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          (row.email?.toLowerCase().includes(needle) ?? false) ||
          (row.phone?.toLowerCase().includes(needle) ?? false),
      );
    }
    return rows;
  }

  async getOne(orgId: string, id: string) {
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    const [persons, addressRows] = await Promise.all([
      this.db.select().from(contactPersons).where(eq(contactPersons.contactId, id)),
      this.db.select().from(addresses).where(eq(addresses.contactId, id)),
    ]);
    return { ...contact, contactPersons: persons, addresses: addressRows };
  }

  /**
   * Duplicate detection: PRD §9 acceptance highlight says matching phone or
   * email "warns ... but does not block." A server-side create endpoint has
   * no UI to show a dismissible warning in, so this surfaces the same
   * signal as a non-fatal field on the response (`duplicateWarning`) rather
   * than rejecting the request — the web layer decides whether to show a
   * confirmation before treating the create as final.
   */
  async create(orgId: string, input: CreateContactInput) {
    const duplicates = await this.findDuplicates(orgId, input.email ?? null, input.phone ?? null);

    const created = await this.db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({
          orgId,
          type: input.type,
          isCompany: input.isCompany ?? false,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      if (!contact) {
        throw new BadRequestException("Failed to create contact");
      }

      if (input.contactPersons?.length) {
        await tx.insert(contactPersons).values(
          input.contactPersons.map((person: ContactPersonInput) => ({
            contactId: contact.id,
            name: person.name,
            title: person.title ?? null,
            email: person.email ?? null,
            phone: person.phone ?? null,
            isPrimary: person.isPrimary ?? false,
          })),
        );
      }
      if (input.addresses?.length) {
        await tx.insert(addresses).values(
          input.addresses.map((address: AddressInput) => ({
            contactId: contact.id,
            type: address.type ?? "billing",
            line1: address.line1,
            line2: address.line2 ?? null,
            city: address.city ?? null,
            state: address.state ?? null,
            postalCode: address.postalCode ?? null,
            country: address.country ?? null,
            isPrimary: address.isPrimary ?? false,
          })),
        );
      }
      return contact;
    });

    const full = await this.getOne(orgId, (created as { id: string }).id);
    return { ...full, duplicateWarning: duplicates.length > 0 ? duplicates : undefined };
  }

  async update(orgId: string, id: string, input: UpdateContactInput) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(contacts)
        .set({
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.isCompany !== undefined ? { isCompany: input.isCompany } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id));

      if (input.contactPersons !== undefined) {
        await tx.delete(contactPersons).where(eq(contactPersons.contactId, id));
        if (input.contactPersons.length) {
          await tx.insert(contactPersons).values(
            input.contactPersons.map((person: ContactPersonInput) => ({
              contactId: id,
              name: person.name,
              title: person.title ?? null,
              email: person.email ?? null,
              phone: person.phone ?? null,
              isPrimary: person.isPrimary ?? false,
            })),
          );
        }
      }
      if (input.addresses !== undefined) {
        await tx.delete(addresses).where(eq(addresses.contactId, id));
        if (input.addresses.length) {
          await tx.insert(addresses).values(
            input.addresses.map((address: AddressInput) => ({
              contactId: id,
              type: address.type ?? "billing",
              line1: address.line1,
              line2: address.line2 ?? null,
              city: address.city ?? null,
              state: address.state ?? null,
              postalCode: address.postalCode ?? null,
              country: address.country ?? null,
              isPrimary: address.isPrimary ?? false,
            })),
          );
        }
      }
    });

    return this.getOne(orgId, id);
  }

  /**
   * Archive (soft-delete), never a hard DELETE — see contacts.ts's schema
   * comment. This is the "deactivation" PRD §9 describes as the alternative
   * to a blocked delete; since archiving is always safe (no dependent-row
   * check needed), it's offered unconditionally rather than only when a
   * hard delete would fail.
   */
  async archive(orgId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    const [updated] = await this.db
      .update(contacts)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async restore(orgId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    const [updated] = await this.db
      .update(contacts)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  /**
   * True hard delete, retained only for a contact with zero ledger
   * references and no leads/activities of its own choosing to keep — used
   * defensively (e.g. this pass's own test cleanup); the web UI only ever
   * offers archive. Blocked outright if any journal_lines reference the
   * contact, since the FK is RESTRICT and would fail anyway — this check
   * exists to return a clear 400 instead of a raw Postgres FK error.
   */
  async delete(orgId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    const [referenced] = await this.db.select().from(journalLines).where(eq(journalLines.contactId, id)).limit(1);
    if (referenced) {
      throw new BadRequestException("Contact has financial ledger history and cannot be deleted — archive it instead");
    }
    await this.db.delete(contacts).where(eq(contacts.id, id));
    return { id };
  }

  private async findDuplicates(orgId: string, email: string | null, phone: string | null) {
    if (!email && !phone) return [];
    const clauses = [];
    if (email) clauses.push(ilike(contacts.email, email));
    if (phone) clauses.push(ilike(contacts.phone, phone));
    return this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), or(...clauses)))
      .orderBy(desc(contacts.createdAt));
  }
}
