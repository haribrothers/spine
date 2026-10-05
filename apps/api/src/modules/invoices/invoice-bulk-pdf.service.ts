import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { BulkResult } from "@spine/shared";
import { and, eq, inArray } from "drizzle-orm";
import { zipSync } from "fflate";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

/**
 * US-INV-24 (D-097, D-132) — the stored PDFs (US-INV-17) of several
 * invoices in one ZIP, "invoices-<date>.zip". Drafts have no issued PDF
 * and are skipped; the result lists every skipped invoice with the reason.
 * PDFs are already compressed, so they're stored in the ZIP as they are.
 */
@Injectable()
export class InvoiceBulkPdfService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly issuedPdf: IssuedPdfService,
  ) {}

  async build(orgId: string, ids: string[]): Promise<{ zip: Buffer; filename: string; result: BulkResult }> {
    const unique = [...new Set(ids)];
    const rows = await this.db
      .select({ id: invoices.id, number: invoices.number, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), inArray(invoices.id, unique)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const result: BulkResult = { done: [], skipped: [] };
    const entries: Record<string, Uint8Array> = {};

    for (const id of unique) {
      const row = byId.get(id);
      if (!row) {
        result.skipped.push({ id, label: null, reason: "Not found." });
        continue;
      }
      const pdf = row.status === "draft" ? null : await this.issuedPdf.getOrStore(orgId, "invoice", id);
      if (!pdf) {
        result.skipped.push({ id, label: row.number, reason: "It's a draft — drafts have no PDF to download yet." });
        continue;
      }
      let name = pdf.filename;
      for (let n = 2; entries[name]; n++) name = pdf.filename.replace(/\.pdf$/, ` (${n}).pdf`);
      entries[name] = new Uint8Array(pdf.buffer);
      result.done.push(id);
    }

    if (!result.done.length) throw new BadRequestException("None of these invoices has a PDF yet — drafts are skipped. Issue them first.");
    const zip = Buffer.from(zipSync(entries, { level: 0 }));
    return { zip, filename: `invoices-${orgClock().date}.zip`, result };
  }
}
