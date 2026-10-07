import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, UnsupportedMediaTypeException } from "@nestjs/common";
import { and, asc, eq, lte } from "drizzle-orm";
import Papa from "papaparse";
import {
  STATEMENT_MAX_BYTES,
  STATEMENT_MAX_ROWS,
  STATEMENT_NOT_CSV,
  STATEMENT_TOO_BIG,
  parseStatementAmount,
  parseStatementDate,
  statementDedupeKey,
  statementMappingSchema,
  type StatementImportResult,
  type StatementLine,
  type StatementLineStatus,
  type StatementMapping,
} from "@spine/shared";
import { orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { bankStatementImports, bankStatementLines, moneyAccounts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { MoneyAccountsService } from "./money-accounts.service";

export interface UploadedStatement {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const CSV_TYPES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", "text/comma-separated-values", "application/octet-stream"]);

/**
 * US-BANK-07 (D-157) — imports a bank's CSV statement into a money
 * account's statement lines. Lines already imported (same date, amount and
 * description) are skipped; unreadable rows are reported with the reason
 * and the rest import. The mapping is saved on the account for next time.
 */
@Injectable()
export class StatementImportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async mapping(orgId: string, moneyAccountId: string): Promise<{ mapping: StatementMapping | null }> {
    const [row] = await this.db
      .select({ mapping: moneyAccounts.statementMapping })
      .from(moneyAccounts)
      .where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.id, moneyAccountId)));
    if (!row) throw new BadRequestException("Money account not found");
    const parsed = statementMappingSchema.safeParse(row.mapping);
    return { mapping: parsed.success ? parsed.data : null };
  }

  async import(orgId: string, actorUserId: string, moneyAccountId: string, file: UploadedStatement | undefined, rawMapping: unknown): Promise<StatementImportResult> {
    if (!file) throw new BadRequestException("Choose the statement file to import.");
    const looksLikeCsv = /\.csv$/i.test(file.originalname) || CSV_TYPES.has(file.mimetype);
    if (!looksLikeCsv || file.buffer.includes(0)) throw new UnsupportedMediaTypeException(STATEMENT_NOT_CSV);
    if (file.size > STATEMENT_MAX_BYTES) throw new BadRequestException(STATEMENT_TOO_BIG);

    let mappingInput: unknown = rawMapping;
    if (typeof rawMapping === "string") {
      try {
        mappingInput = JSON.parse(rawMapping);
      } catch {
        throw new BadRequestException("Map the statement's columns, then import.");
      }
    }
    const mappingParsed = statementMappingSchema.safeParse(mappingInput);
    if (!mappingParsed.success) throw new BadRequestException(mappingParsed.error.issues[0]?.message ?? "Map the statement's columns, then import.");
    const mapping = mappingParsed.data;

    const text = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    const headers = parsed.meta.fields ?? [];
    if (!headers.length) throw new UnsupportedMediaTypeException(STATEMENT_NOT_CSV);
    if (parsed.data.length > STATEMENT_MAX_ROWS) throw new BadRequestException(STATEMENT_TOO_BIG);
    for (const columnName of [mapping.date, mapping.description, mapping.reference, mapping.amount, mapping.moneyIn, mapping.moneyOut, mapping.balance]) {
      if (columnName && !headers.includes(columnName)) throw new BadRequestException(`The file has no column called ${columnName}. Choose another column.`);
    }

    const { currency } = await orgMoneySettings(this.db, orgId);
    const failed: StatementImportResult["failed"] = [];
    const lines: Omit<typeof bankStatementLines.$inferInsert, "importId">[] = [];
    parsed.data.forEach((row, index) => {
      const rowNumber = index + 2;
      const cell = (name: string | null) => (name ? (row[name] ?? "").trim() : "");
      const date = parseStatementDate(cell(mapping.date), mapping.dateFormat);
      if (!date) {
        failed.push({ row: rowNumber, reason: `Couldn't read the date "${cell(mapping.date)}".` });
        return;
      }
      let amount: bigint | null;
      if (mapping.amountMode === "single") {
        amount = parseStatementAmount(cell(mapping.amount), currency);
      } else {
        const moneyIn = cell(mapping.moneyIn) ? parseStatementAmount(cell(mapping.moneyIn), currency) : 0n;
        const moneyOut = cell(mapping.moneyOut) ? parseStatementAmount(cell(mapping.moneyOut), currency) : 0n;
        const abs = (v: bigint) => (v < 0n ? -v : v);
        amount = moneyIn === null || moneyOut === null || (!cell(mapping.moneyIn) && !cell(mapping.moneyOut)) ? null : abs(moneyIn) - abs(moneyOut);
      }
      if (amount === null) {
        failed.push({ row: rowNumber, reason: "Couldn't read the amount." });
        return;
      }
      const description = cell(mapping.description);
      const balance = cell(mapping.balance) ? parseStatementAmount(cell(mapping.balance), currency) : null;
      lines.push({
        orgId,
        moneyAccountId,
        date,
        description,
        reference: cell(mapping.reference) || null,
        amount,
        runningBalance: balance,
        dedupeKey: statementDedupeKey(date, amount, description),
        rowNumber,
      });
    });

    return this.db.transaction(async (tx) => {
      await this.moneyAccounts.requireActive(tx, orgId, moneyAccountId);
      const importId = randomUUID();
      await tx.insert(bankStatementImports).values({ id: importId, orgId, moneyAccountId, fileName: file.originalname, importedCount: 0, skippedCount: 0, failedRows: failed, importedByUserId: actorUserId });
      let imported = 0;
      for (let i = 0; i < lines.length; i += 500) {
        const inserted = await tx
          .insert(bankStatementLines)
          .values(lines.slice(i, i + 500).map((l) => ({ ...l, importId })))
          .onConflictDoNothing({ target: [bankStatementLines.moneyAccountId, bankStatementLines.dedupeKey] })
          .returning({ id: bankStatementLines.id });
        imported += inserted.length;
      }
      const skipped = lines.length - imported;
      await tx.update(bankStatementImports).set({ importedCount: imported, skippedCount: skipped }).where(eq(bankStatementImports.id, importId));
      await tx.update(moneyAccounts).set({ statementMapping: mapping, updatedAt: new Date() }).where(eq(moneyAccounts.id, moneyAccountId));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "statement_imported",
        entityType: "money_account",
        entityId: moneyAccountId,
        contactId: null,
        changes: { file: file.originalname, imported, skipped, failed: failed.length },
      });
      return { importId, imported, skipped, failed };
    });
  }

  async lines(orgId: string, moneyAccountId: string, query: { status?: StatementLineStatus; to?: string }): Promise<StatementLine[]> {
    await this.moneyAccounts.get(orgId, moneyAccountId);
    const rows = await this.db
      .select({ line: bankStatementLines, fileName: bankStatementImports.fileName })
      .from(bankStatementLines)
      .innerJoin(bankStatementImports, eq(bankStatementImports.id, bankStatementLines.importId))
      .where(
        and(
          eq(bankStatementLines.orgId, orgId),
          eq(bankStatementLines.moneyAccountId, moneyAccountId),
          query.status ? eq(bankStatementLines.status, query.status) : undefined,
          query.to ? lte(bankStatementLines.date, query.to) : undefined,
        ),
      )
      .orderBy(asc(bankStatementLines.date), asc(bankStatementLines.createdAt), asc(bankStatementLines.rowNumber));
    return rows.map((r) => toStatementLine(r.line, r.fileName));
  }
}

export function toStatementLine(line: typeof bankStatementLines.$inferSelect, fileName: string | null): StatementLine {
  return {
    id: line.id,
    date: line.date,
    description: line.description,
    reference: line.reference,
    amount: line.amount.toString(),
    runningBalance: line.runningBalance === null ? null : line.runningBalance.toString(),
    status: line.status,
    excludeNote: line.excludeNote,
    fileName,
  };
}
