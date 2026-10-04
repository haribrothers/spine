import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { numberSequences } from "../../db/schema";

/**
 * Canonical document types per docs/archive/spine-prd.md §14.3 — everything with a
 * system-generated sequence. Vendor Bill is deliberately excluded: its
 * number is user-entered (the vendor's own number), so it never gets a row
 * here. `vendor_payment` (FEAT-07/S-07.8) is the vendor-side mirror of the
 * existing customer-side `receipt` type — a separate type rather than
 * reusing "receipt", since a receipt of money coming in and a payment
 * going out are conceptually distinct documents even though both are
 * "payments" internally.
 */
export const NUMBERING_DOCUMENT_TYPES = [
  "quote",
  "invoice",
  "credit_note",
  "receipt",
  "expense",
  "job",
  "vendor_payment",
] as const;
export type NumberingDocumentType = (typeof NUMBERING_DOCUMENT_TYPES)[number];

export const NUMBERING_DEFAULTS: Record<NumberingDocumentType, { prefix: string; padding: number }> = {
  quote: { prefix: "QUO", padding: 4 },
  invoice: { prefix: "INV", padding: 4 },
  credit_note: { prefix: "CRN", padding: 4 },
  receipt: { prefix: "RCP", padding: 4 },
  expense: { prefix: "EXP", padding: 4 },
  job: { prefix: "JOB", padding: 3 },
  vendor_payment: { prefix: "VPY", padding: 4 },
};

/**
 * Read/configure `number_sequences` rows — this module does NOT allocate
 * numbers (that's the issuing transaction's job, via a row lock, per
 * §6.5/CLAUDE.md) — it only lets the onboarding wizard (and later Settings)
 * set the prefix/padding/starting number per document type before any
 * document has been issued.
 */
@Injectable()
export class NumberingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listSequences(orgId: string) {
    const rows = await this.db.select().from(numberSequences).where(eq(numberSequences.orgId, orgId));
    const byType = new Map(rows.map((row) => [row.documentType, row]));
    // Always return one entry per canonical document type, defaulted if the
    // org hasn't configured it yet, so the wizard step has something to
    // render even before any row exists.
    return NUMBERING_DOCUMENT_TYPES.map((documentType) => {
      const existing = byType.get(documentType);
      return (
        existing ?? {
          id: null,
          orgId,
          documentType,
          prefix: NUMBERING_DEFAULTS[documentType].prefix,
          padding: NUMBERING_DEFAULTS[documentType].padding,
          yearToken: null,
          nextValue: 1,
          updatedAt: null,
        }
      );
    });
  }

  /**
   * Upsert on (orgId, documentType). Changing prefix/padding/starting
   * number is only safe before any document of that type has been issued —
   * this endpoint doesn't currently block a change after issuance (out of
   * scope for the wizard shell; the numbering module's own future work can
   * add that guard once quotes/invoices actually issue documents).
   */
  async upsertSequence(
    orgId: string,
    documentType: NumberingDocumentType,
    input: { prefix: string; padding: number; nextValue?: number },
  ) {
    const [existing] = await this.db
      .select()
      .from(numberSequences)
      .where(and(eq(numberSequences.orgId, orgId), eq(numberSequences.documentType, documentType)));

    if (existing) {
      const [updated] = await this.db
        .update(numberSequences)
        .set({
          prefix: input.prefix,
          padding: input.padding,
          ...(input.nextValue !== undefined ? { nextValue: input.nextValue } : {}),
          updatedAt: new Date(),
        })
        .where(eq(numberSequences.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(numberSequences)
      .values({
        orgId,
        documentType,
        prefix: input.prefix,
        padding: input.padding,
        nextValue: input.nextValue ?? 1,
      })
      .returning();
    return created;
  }

  /**
   * Allocates the next gapless, permanent number for `documentType`, per
   * CLAUDE.md ("Allocated inside the issuing transaction via a row lock on
   * a sequence table"). MUST be called with `tx` being the same open
   * transaction as the document-issuing write (e.g. QuotesService.send's
   * `status: "draft" -> "sent"` update) — never call this outside a
   * transaction, and never call it more than once per issuing transaction.
   *
   * `SELECT ... FOR UPDATE` locks the org+documentType row for the
   * duration of the caller's transaction, so a concurrent `send` on a
   * second quote blocks here until the first transaction commits or rolls
   * back, guaranteeing no two documents of the same type in the same org
   * ever receive the same number and no number is skipped. If no sequence
   * row exists yet for this org+documentType, one is created inline using
   * this module's own defaults (`NUMBERING_DEFAULTS`) rather than throwing
   * — a fresh org that skipped the numbering onboarding step must still be
   * able to issue its first quote.
   */
  async allocateNumber(tx: Transaction, orgId: string, documentType: NumberingDocumentType): Promise<string> {
    const [locked] = await tx
      .select()
      .from(numberSequences)
      .where(and(eq(numberSequences.orgId, orgId), eq(numberSequences.documentType, documentType)))
      .for("update");

    const current =
      locked ??
      (
        await tx
          .insert(numberSequences)
          .values({
            orgId,
            documentType,
            prefix: NUMBERING_DEFAULTS[documentType].prefix,
            padding: NUMBERING_DEFAULTS[documentType].padding,
            nextValue: 1,
          })
          .returning()
      )[0];

    if (!current) {
      throw new Error(`Failed to allocate a ${documentType} number for org ${orgId}`);
    }

    await tx
      .update(numberSequences)
      .set({ nextValue: current.nextValue + 1, updatedAt: new Date() })
      .where(eq(numberSequences.id, current.id));

    const padded = String(current.nextValue).padStart(current.padding, "0");
    return current.yearToken ? `${current.prefix}-${current.yearToken}-${padded}` : `${current.prefix}-${padded}`;
  }
}
