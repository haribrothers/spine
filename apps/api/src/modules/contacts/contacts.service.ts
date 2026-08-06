import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { addressInputSchema, contactPersonInputSchema, createContactSchema, updateContactSchema } from "@spine/shared";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { addresses, contactPersons, contacts, journalLines } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

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
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, options: { types?: ("customer" | "vendor" | "both")[]; search?: string; includeArchived?: boolean }) {
    const conditions = [eq(contacts.orgId, orgId)];
    if (options.types?.length) {
      conditions.push(inArray(contacts.type, options.types));
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
  async create(orgId: string, actorUserId: string, input: CreateContactInput) {
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
          taxId: input.taxId ?? null,
          website: input.website ?? null,
          logoFileId: input.logoFileId ?? null,
        })
        .returning();
      if (!contact) {
        throw new BadRequestException("Failed to create contact");
      }

      if (input.contactPersons?.length) {
        const insertedPersons = await tx
          .insert(contactPersons)
          .values(
            input.contactPersons.map((person: ContactPersonInput) => ({
              contactId: contact.id,
              name: person.name,
              title: person.title ?? null,
              email: person.email ?? null,
              phone: person.phone ?? null,
              isPrimary: person.isPrimary ?? false,
              logoFileId: person.logoFileId ?? null,
            })),
          )
          .returning();
        for (const person of insertedPersons) {
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "contact_person",
            entityId: person.id,
            contactId: contact.id,
            changes: [{ field: "name", from: null, to: person.name }],
          });
        }
      }
      if (input.addresses?.length) {
        const insertedAddresses = await tx
          .insert(addresses)
          .values(
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
          )
          .returning();
        for (const address of insertedAddresses) {
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "created",
            entityType: "address",
            entityId: address.id,
            contactId: contact.id,
            changes: [{ field: "line1", from: null, to: address.line1 }],
          });
        }
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "contact",
        entityId: contact.id,
        contactId: contact.id,
        changes: [{ field: "name", from: null, to: contact.name }],
      });

      return contact;
    });

    const full = await this.getOne(orgId, (created as { id: string }).id);
    return { ...full, duplicateWarning: duplicates.length > 0 ? duplicates : undefined };
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateContactInput) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }

    // Read-before-write for the persons/addresses arrays too — needed to
    // diff old-vs-new by id (see diffArrayById below), not just for the
    // contact's own scalar fields.
    const [existingPersons, existingAddresses] = await Promise.all([
      input.contactPersons !== undefined
        ? this.db.select().from(contactPersons).where(eq(contactPersons.contactId, id))
        : Promise.resolve([]),
      input.addresses !== undefined ? this.db.select().from(addresses).where(eq(addresses.contactId, id)) : Promise.resolve([]),
    ]);

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
          ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
          ...(input.website !== undefined ? { website: input.website } : {}),
          ...(input.logoFileId !== undefined ? { logoFileId: input.logoFileId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id));

      // Only diff the contact's own scalar fields — `input` also carries
      // `contactPersons`/`addresses` (handled as their own granular
      // created/updated/removed entries below), which aren't real columns
      // on `contacts` and would otherwise show up as a nonsensical
      // "contactPersons: null -> [...]" noise entry.
      const { contactPersons: _cp, addresses: _addr, ...scalarInput } = input;
      const contactChanges = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, scalarInput as Record<string, unknown>);
      if (contactChanges.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "contact",
          entityId: id,
          contactId: id,
          changes: contactChanges,
        });
      }

      if (input.contactPersons !== undefined) {
        await tx.delete(contactPersons).where(eq(contactPersons.contactId, id));
        let insertedPersons: (typeof contactPersons.$inferSelect)[] = [];
        if (input.contactPersons.length) {
          insertedPersons = await tx
            .insert(contactPersons)
            .values(
              input.contactPersons.map((person: ContactPersonInput) => ({
                contactId: id,
                name: person.name,
                title: person.title ?? null,
                email: person.email ?? null,
                phone: person.phone ?? null,
                isPrimary: person.isPrimary ?? false,
                logoFileId: person.logoFileId ?? null,
              })),
            )
            .returning();
        }
        await this.recordArrayDiff(tx, {
          orgId,
          actorUserId,
          contactId: id,
          entityType: "contact_person",
          before: existingPersons,
          input: input.contactPersons,
          after: insertedPersons,
          displayField: "name",
        });
      }
      if (input.addresses !== undefined) {
        await tx.delete(addresses).where(eq(addresses.contactId, id));
        let insertedAddresses: (typeof addresses.$inferSelect)[] = [];
        if (input.addresses.length) {
          insertedAddresses = await tx
            .insert(addresses)
            .values(
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
            )
            .returning();
        }
        await this.recordArrayDiff(tx, {
          orgId,
          actorUserId,
          contactId: id,
          entityType: "address",
          before: existingAddresses,
          input: input.addresses,
          after: insertedAddresses,
          displayField: "line1",
        });
      }
    });

    return this.getOne(orgId, id);
  }

  /**
   * Whole-array-replace PUT means every write to contactPersons/addresses
   * deletes and re-inserts the entire list (see this class's own top
   * comment) — the re-inserted rows get brand-new ids even for entries the
   * client sent an existing `id` on, so this can't diff by comparing ids
   * after the fact. Instead it diffs the *input* array (which still carries
   * each element's original `id`, or no `id` for a newly-added entry)
   * against the row it matches in `before`, positionally paired with
   * `after` (both arrays were built from the same `input` array in the
   * same order, so `input[i]` corresponds to `after[i]`) to know each
   * change's real post-insert row id for `entityId`.
   *   - An input entry with an `id` matching a `before` row -> "updated"
   *     if any field actually changed, using AuditLogService.diffFields.
   *   - An input entry with no `id`, or an `id` not found in `before` ->
   *     "created" (new-since-last-save, per the task brief's rule).
   *   - A `before` row whose `id` has no matching entry in the input array
   *     -> "removed".
   */
  private async recordArrayDiff<T extends { id: string }>(
    tx: Transaction,
    params: {
      orgId: string;
      actorUserId: string;
      contactId: string;
      entityType: "contact_person" | "address";
      before: T[];
      input: ({ id?: string } & Record<string, unknown>)[];
      after: T[];
      displayField: string;
    },
  ) {
    const { orgId, actorUserId, contactId, entityType, before, input, after, displayField } = params;
    const beforeById = new Map(before.map((row) => [row.id, row]));
    const matchedBeforeIds = new Set<string>();

    for (let i = 0; i < input.length; i++) {
      const entry = input[i]!;
      const afterRow = after[i];
      const beforeRow = entry.id ? beforeById.get(entry.id) : undefined;

      if (beforeRow) {
        matchedBeforeIds.add(beforeRow.id);
        const changes = AuditLogService.diffFields(beforeRow as unknown as Record<string, unknown>, entry);
        if (changes.length && afterRow) {
          await this.auditLog.record(tx, {
            orgId,
            actorUserId,
            action: "updated",
            entityType,
            entityId: afterRow.id,
            contactId,
            changes,
          });
        }
      } else if (afterRow) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "created",
          entityType,
          entityId: afterRow.id,
          contactId,
          changes: [{ field: displayField, from: null, to: entry[displayField] ?? null }],
        });
      }
    }

    for (const row of before) {
      if (!matchedBeforeIds.has(row.id)) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "removed",
          entityType,
          entityId: row.id,
          contactId,
          changes: [{ field: displayField, from: (row as unknown as Record<string, unknown>)[displayField] ?? null, to: null }],
        });
      }
    }
  }

  /**
   * Archive (soft-delete), never a hard DELETE — see contacts.ts's schema
   * comment. This is the "deactivation" PRD §9 describes as the alternative
   * to a blocked delete; since archiving is always safe (no dependent-row
   * check needed), it's offered unconditionally rather than only when a
   * hard delete would fail.
   */
  async archive(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(contacts)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "archived",
        entityType: "contact",
        entityId: id,
        contactId: id,
      });
      return row;
    });
    return updated;
  }

  async restore(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(contacts)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "restored",
        entityType: "contact",
        entityId: id,
        contactId: id,
      });
      return row;
    });
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
  async delete(orgId: string, id: string, actorUserId: string) {
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
    await this.db.transaction(async (tx) => {
      // Record the "deleted" audit entry with contactId: null, not id — the
      // row is about to be hard-deleted and audit_log.contact_id has
      // ON DELETE CASCADE (see audit.ts's schema comment), so a row
      // pointing at this contact would be cascade-deleted along with it in
      // the same transaction, destroying the very entry meant to record
      // the deletion. entityId still records which contact this was, for
      // an org-wide audit view later; it just isn't reachable from
      // GET /contacts/:id/history any more, correctly, since that contact
      // no longer exists to have a history page.
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "contact",
        entityId: id,
        contactId: null,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(contacts).where(eq(contacts.id, id));
    });
    return { id };
  }

  /** `GET /contacts/:id/history` — confirms the contact exists (org-scoped) before delegating to AuditLogService. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForContact(orgId, id);
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
