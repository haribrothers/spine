import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DATA_EXPORT_TTL_DAYS, formatBytes, type CreateDataExport, type DataExportFormat, type DataExportSummary } from "@spine/shared";
import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { getMemberRole } from "../../auth/capability.util";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { PassThrough, type Readable } from "node:stream";
import { toCsv } from "../../common/csv";
import { orgClock } from "../../common/org-clock";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { attachments, dataExports, files, member, settings, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { loadEmailBrand } from "../email/email-brand";
import { appUrl, renderEmail } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { FilesService } from "../files/files.service";
import { QueueService } from "../queue/queue.service";
import { EXPORT_TABLES, SECRET_SETTING, exportColumns, type ExportTable } from "./data-export.tables";

export const DATA_EXPORT_QUEUE = "data-export";

type Row = Record<string, unknown>;

/** One value for a CSV cell: dates as ISO 8601, objects as JSON. */
function cell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  if (typeof value === "boolean") return value ? "true" : "false";
  return value as string | number;
}

function toJson(rows: Row[]): string {
  return JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

/** `files/<id>-<name>` — or, for a file attached to a record, `attachments/<entity>/<record id>/<id>-<name>` (US-OPS-34) — safe for every unzip tool. */
function zipFileName(id: string, original: string, attachedTo?: { entityType: string; entityId: string }): string {
  const safe = original.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";
  return attachedTo ? `attachments/${attachedTo.entityType}/${attachedTo.entityId}/${id}-${safe}` : `files/${id}-${safe}`;
}

/**
 * US-SET-15/16 (D-094) — prepares the organisation's data as a ZIP in the
 * background, stores it privately, emails the Owner a link to Settings ›
 * Data export (never to the file), serves it only to Owners, and deletes it
 * after 7 days. Preparing and downloading are both in the audit log.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly files: FilesService,
    private readonly audit: AuditLogService,
    private readonly email: EmailService,
  ) {}

  async request(orgId: string, userId: string, input: CreateDataExport): Promise<DataExportSummary> {
    const [running] = await this.db.select().from(dataExports).where(and(eq(dataExports.orgId, orgId), eq(dataExports.status, "preparing"))).limit(1);
    if (running) return this.summary(running);
    const formats = [...new Set(input.formats)] as DataExportFormat[];
    const [row] = await this.db.insert(dataExports).values({ orgId, requestedByUserId: userId, formats, includeFiles: input.includeFiles }).returning();
    await this.audit.record(this.db, { orgId, actorUserId: userId, action: "prepared", entityType: "data_export", entityId: row!.id, contactId: null, changes: { formats: formats.join(", "), files: input.includeFiles ? "included" : "not included" } });
    await this.queue.send(DATA_EXPORT_QUEUE, { exportId: row!.id });
    return this.summary(row!);
  }

  /** The latest export, or null. An export past its 7 days is cleared on the way. */
  async latest(orgId: string): Promise<DataExportSummary | null> {
    const [row] = await this.db.select().from(dataExports).where(and(eq(dataExports.orgId, orgId), ne(dataExports.status, "failed"))).orderBy(desc(dataExports.createdAt)).limit(1);
    if (!row) return null;
    const current = await this.expireIfDue(row);
    return this.summary(current);
  }

  /**
   * The ZIP, for an Owner of the organisation, while it's ready and not
   * expired. Anyone else — Staff, Field, no session, another organisation —
   * gets 404, as if it didn't exist.
   */
  async download(orgId: string | null, userId: string | null, id: string): Promise<{ stream: Readable; filename: string; size: number | null }> {
    const notFound = new NotFoundException("This export isn't available. Prepare a new one in Settings › Data export.");
    if (!orgId || !userId || !/^[0-9a-f-]{36}$/i.test(id)) throw notFound;
    if ((await getMemberRole(this.db, orgId, userId)) !== "owner") throw notFound;
    const [row] = await this.db.select().from(dataExports).where(and(eq(dataExports.orgId, orgId), eq(dataExports.id, id)));
    if (!row) throw notFound;
    const current = await this.expireIfDue(row);
    if (current.status !== "ready" || !current.fileId) throw notFound;
    const [file] = await this.db.select().from(files).where(eq(files.id, current.fileId));
    if (!file) throw notFound;
    const stream = await this.files.openStored(file);
    await this.audit.record(this.db, { orgId, actorUserId: userId, action: "downloaded", entityType: "data_export", entityId: row.id, contactId: null, changes: null });
    return { stream, filename: file.originalFilename, size: current.sizeBytes };
  }

  /** Deletes every export past its 7 days (the hourly sweep). */
  async sweepExpired(now = new Date()): Promise<number> {
    const due = await this.db.select().from(dataExports).where(and(eq(dataExports.status, "ready"), lt(dataExports.expiresAt, now)));
    for (const row of due) await this.expireIfDue(row, now);
    return due.length;
  }

  private async expireIfDue(row: typeof dataExports.$inferSelect, now = new Date()): Promise<typeof dataExports.$inferSelect> {
    if (row.status !== "ready" || !row.expiresAt || row.expiresAt > now) return row;
    if (row.fileId) await this.files.deleteStored(row.orgId, row.fileId);
    const [updated] = await this.db.update(dataExports).set({ status: "expired", fileId: null, updatedAt: now }).where(eq(dataExports.id, row.id)).returning();
    return updated!;
  }

  /** Builds and stores the ZIP for one export (the `data-export` job). */
  async process(exportId: string): Promise<void> {
    const [row] = await this.db.select().from(dataExports).where(eq(dataExports.id, exportId));
    if (!row || row.status !== "preparing") return;
    try {
      const date = orgClock().date;
      const zipStream = this.buildZip(row.orgId, row.formats, row.includeFiles);
      const file = await this.files.storeGenerated(row.orgId, zipStream, { originalFilename: `spine-export-${date}.zip`, mimeType: "application/zip", uploadedByUserId: row.requestedByUserId });
      const expiresAt = new Date(Date.now() + DATA_EXPORT_TTL_DAYS * 86_400_000);
      await this.db.update(dataExports).set({ status: "ready", fileId: file.id, sizeBytes: Number(file.sizeBytes), expiresAt, updatedAt: new Date() }).where(eq(dataExports.id, row.id));
      await this.notifyReady(row.orgId, row.requestedByUserId, Number(file.sizeBytes));
    } catch (err) {
      this.logger.error(`Data export ${exportId} failed: ${(err as Error).message}`);
      await this.db.update(dataExports).set({ status: "failed", error: (err as Error).message.slice(0, 500), updatedAt: new Date() }).where(eq(dataExports.id, row.id));
    }
  }

  /** The ZIP as a stream: one CSV and/or JSON per table, README.txt, and files/ when asked. */
  buildZip(orgId: string, formats: DataExportFormat[], includeFiles: boolean): Readable {
    const out = new PassThrough();
    const zip = new Zip((err, chunk, final) => {
      if (err) return void out.destroy(err);
      out.write(Buffer.from(chunk));
      if (final) out.end();
    });
    const addText = (name: string, text: string) => {
      const entry = new ZipDeflate(name, { level: 6 });
      zip.add(entry);
      entry.push(new TextEncoder().encode(text), true);
    };

    void (async () => {
      const readme: string[] = [];
      const both = formats.length > 1;
      for (const spec of EXPORT_TABLES) {
        const rows = await this.rowsFor(orgId, spec);
        const columns = Object.keys(exportColumns(spec.table));
        for (const format of formats) {
          const path = `${both ? `${format}/` : ""}${spec.name}.${format}`;
          addText(path, format === "csv" ? toCsv(columns, rows.map((r) => columns.map((c) => cell(r[c])))) : toJson(rows));
          readme.push(`${path} — ${spec.description} ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`);
        }
      }
      // People: names, emails and roles only — never passwords or sessions.
      const people = await this.db
        .select({ userId: user.id, name: user.name, email: user.email, role: member.role, isActive: member.isActive, joinedAt: member.createdAt })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, orgId));
      for (const format of formats) {
        const path = `${both ? `${format}/` : ""}members.${format}`;
        const cols = ["userId", "name", "email", "role", "isActive", "joinedAt"];
        addText(path, format === "csv" ? toCsv(cols, people.map((p) => cols.map((c) => cell((p as Row)[c])))) : toJson(people));
        readme.push(`${path} — Everyone with access: name, email, role and whether they're active. ${people.length} rows.`);
      }

      if (includeFiles) {
        const stored = await this.db
          .select()
          .from(files)
          .where(and(eq(files.orgId, orgId), sql`${files.id} not in (select ${dataExports.fileId} from ${dataExports} where ${dataExports.fileId} is not null)`));
        const attached = new Map(
          (
            await this.db
              .select({ fileId: attachments.fileId, entityType: attachments.entityType, entityId: attachments.entityId })
              .from(attachments)
              .where(and(eq(attachments.orgId, orgId), isNull(attachments.removedAt)))
          ).map((a) => [a.fileId, a]),
        );
        for (const file of stored) {
          const entry = new ZipPassThrough(zipFileName(file.id, file.originalFilename, attached.get(file.id)));
          zip.add(entry);
          try {
            for await (const chunk of await this.files.openStored(file)) entry.push(chunk as Uint8Array);
          } catch (err) {
            this.logger.warn(`Data export: file ${file.id} couldn't be read: ${(err as Error).message}`);
          }
          entry.push(new Uint8Array(0), true);
        }
        readme.push(`files/ — Receipts, photos, signatures, logos and issued PDFs in their original format, named <file id>-<original name>; files.${formats[0]} lists them. ${stored.length - attached.size} files.`);
        readme.push(`attachments/ — Files attached to records, in attachments/<record type>/<record id>/; attachments.${formats[0]} lists them. ${attached.size} files.`);
      }

      addText(
        "README.txt",
        [
          "Spine data export",
          `Prepared ${new Date().toISOString()}.`,
          "",
          "Each table is one file with a header row (CSV) or an array of objects (JSON). Ids link rows across files: for example invoice_lines.invoiceId is an invoices.id.",
          "Amounts are in minor units (cents) as whole numbers; dates and times are ISO 8601. Passwords, sessions, sign-in tokens and other secrets are never included.",
          "",
          ...readme,
          "",
        ].join("\r\n"),
      );
      zip.end();
    })().catch((err) => out.destroy(err));

    return out;
  }

  private async rowsFor(orgId: string, spec: ExportTable): Promise<Row[]> {
    const columns = exportColumns(spec.table);
    const table = spec.table as PgTable & Record<string, PgColumn>;
    let where;
    if (spec.via) {
      const parent = spec.via.parent as PgTable & Record<string, PgColumn>;
      const parentIds = this.db.select({ id: parent.id! }).from(spec.via.parent).where(eq(parent.orgId!, orgId));
      where = inArray(table[spec.via.column]!, parentIds);
    } else {
      where = eq(table.orgId!, orgId);
    }
    let rows = (await this.db.select(columns).from(spec.table).where(where)) as Row[];
    if (spec.table === settings) rows = rows.filter((r) => !SECRET_SETTING.test(String(r.key)));
    return rows;
  }

  private async notifyReady(orgId: string, userId: string | null, size: number): Promise<void> {
    if (!userId || !this.email.isConfigured()) return;
    const [who] = await this.db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId));
    if (!who) return;
    const brand = await loadEmailBrand(this.db, orgId);
    const content = {
      heading: "Your data export is ready",
      greeting: `Hi ${who.name.split(/\s+/)[0] || "there"},`,
      paragraphs: [`The export of ${brand.name}'s data you asked for is ready (${formatBytes(size)}). Download it from Settings › Data export within ${DATA_EXPORT_TTL_DAYS} days; after that it's deleted.`],
      button: { label: "Open Data export", url: appUrl("/dashboard?settings=data-export") },
      note: "For your security the file isn't attached or linked here: it can only be downloaded by an owner signed in to Spine.",
      footerNote: `You're getting this because you asked for a data export of ${brand.name}.`,
    };
    const email = renderEmail(brand, content);
    await this.email
      .send({ to: who.email, fromName: brand.name, subject: `Your ${brand.name} data export is ready`, text: email.text, html: email.html, attachments: email.attachments, log: { orgId, kind: "data_export", userId } })
      .catch((err) => this.logger.warn(`Data export email failed: ${(err as Error).message}`));
  }

  private async summary(row: typeof dataExports.$inferSelect): Promise<DataExportSummary> {
    const [who] = row.requestedByUserId ? await this.db.select({ name: user.name }).from(user).where(eq(user.id, row.requestedByUserId)) : [];
    return {
      id: row.id,
      status: row.status as DataExportSummary["status"],
      formats: row.formats,
      includeFiles: row.includeFiles,
      requestedBy: who?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      sizeBytes: row.sizeBytes ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }
}
