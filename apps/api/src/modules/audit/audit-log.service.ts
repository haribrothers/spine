import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { auditLog, user } from "../../db/schema";

export type AuditEntityType =
  | "contact"
  | "contact_person"
  | "address"
  | "lead"
  | "lead_stage"
  | "activity"
  | "meeting"
  | "catalog_item"
  | "catalog_bundle"
  | "quote"
  | "quote_line"
  | "invoice"
  | "invoice_line"
  | "credit_note"
  | "payment"
  | "job"
  | "milestone"
  | "job_note"
  | "job_photo"
  | "tax_rate"
  | "tax_group"
  | "vendor_bill"
  | "vendor_bill_line"
  | "expense_category"
  | "expense"
  | "vendor_payment"
  | "recurring_invoice"
  // US-SET-11: role and access changes; entity id is the member's user id.
  | "user"
  // US-SET-16: data exports prepared and downloaded.
  | "data_export"
  // US-BANK-01: bank, cash and card accounts added, renamed, archived or restored.
  | "money_account"
  // US-BANK-04/05: transfers and other money in or out, recorded and deleted.
  | "bank_transfer"
  | "bank_transaction"
  // US-PUR-24: vendor credits.
  | "vendor_credit"
  // US-TAX-08: tax paid to or refunded by the authority.
  | "tax_payment";

// Note: public quote-response audit rows (S-03.6) use entityType "quote"
// with actorUserId: null (the customer isn't a system user) — see
// PublicQuotesService, which reuses this same service rather than adding a
// new entity type for what is still, structurally, a quote mutation.

/** A single before/after field change, as recorded in `audit_log.changes`. */
export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/**
 * Writes to `audit_log` — the first real writer anywhere in this codebase
 * (the table previously existed in schema only, per CHANGELOG's "Next up").
 * Scoped to Contacts for now per the task brief; a system-wide rollout to
 * other modules is future work, not attempted here.
 *
 * `record()` takes an already-open transaction handle (`tx`) rather than
 * `this.db` so every call joins the same DB transaction as the mutation it
 * documents — an audit row must never persist if the mutation it describes
 * rolled back, and vice versa. Callers that aren't already inside a
 * `db.transaction(...)` (e.g. LeadsService/ActivitiesService's create/
 * update/delete, which today are single-statement, non-transactional
 * writes) pass `this.db` itself, which drizzle-orm accepts anywhere a `tx`
 * is accepted since both implement the same query-builder interface.
 */
@Injectable()
export class AuditLogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * `changes` is a plain array of `{field, from, to}` — a shallow diff of
   * only the fields that actually changed, not a full before/after
   * snapshot. Deliberately not a generic deep-diffing library: every caller
   * already has both the old row and the new input in hand, so computing
   * "for each key in the update payload, if old !== new, record it" is a
   * few lines per call site (see `diffFields` below) and needs nothing
   * more sophisticated for a v1 history view.
   */
  async record(
    tx: Database | Transaction,
    params: {
      orgId: string;
      actorUserId: string | null;
      action: string;
      entityType: AuditEntityType;
      entityId: string;
      contactId: string | null;
      changes?: FieldChange[] | Record<string, unknown> | null;
    },
  ) {
    await tx.insert(auditLog).values({
      orgId: params.orgId,
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      contactId: params.contactId,
      changes: params.changes ?? null,
    });
  }

  /**
   * Shallow before/after diff helper shared by every call site: given the
   * row as it existed before the write and the (partial) input the caller
   * sent, returns one `FieldChange` per key present in `input` whose value
   * actually differs from `before`. Only keys present on `input` are
   * considered — an `undefined` field in a partial update means "not
   * touched," matching every service's own existing `input.x !== undefined
   * ? {x: input.x} : {}` gating convention.
   */
  static diffFields<T extends Record<string, unknown>>(before: T, input: Partial<T>): FieldChange[] {
    const changes: FieldChange[] = [];
    for (const key of Object.keys(input) as (keyof T)[]) {
      if (input[key] === undefined) continue;
      const from = before[key];
      const to = input[key];
      const normalize = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
      if (normalize(from) !== normalize(to)) {
        changes.push({ field: String(key), from: from ?? null, to: to ?? null });
      }
    }
    return changes;
  }

  /**
   * `GET /contacts/:id/history` — every audit row for a contact and its
   * four sub-entity types, newest first, with the actor's display name
   * resolved server-side (a left join to `user` via `member`... actually
   * directly to `user` by id, since `actorUserId` already stores
   * `user.id`) so the web client needs no second lookup. `actorUserId` is
   * nullable (`ON DELETE SET NULL`) — a departed user's history rows are
   * still returned, with `actorName: null`, rather than dropped.
   */
  async listForContact(orgId: string, contactId: string) {
    const rows = await this.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
        actorUserId: auditLog.actorUserId,
        actorName: user.name,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.contactId, contactId)))
      .orderBy(desc(auditLog.createdAt));
    return rows;
  }

  /**
   * `GET /invoices/:id/history` and its Payments/Credit-Notes equivalents —
   * unlike `listForContact` (every row tied to a contact across ALL entity
   * types), this returns only the rows for one specific document: exactly
   * `entityType`+`entityId`, nothing pulled in from a related contact's
   * other documents. Backed by `audit_log_entity_idx` (already present in
   * schema since before any query used it — see audit.ts's own comment),
   * so no migration was needed to add this. Same actor-name left join and
   * row shape as `listForContact`, so both can share one web-side
   * `HistorySection` component.
   */
  async listForEntity(orgId: string, entityType: AuditEntityType, entityId: string) {
    const rows = await this.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
        actorUserId: auditLog.actorUserId,
        actorName: user.name,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
      .orderBy(desc(auditLog.createdAt));
    return rows;
  }
}
