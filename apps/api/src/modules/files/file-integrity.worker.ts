import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { QueueService } from "../queue/queue.service";
import { type FileRow, FilesService } from "./files.service";

export const FILE_INTEGRITY_QUEUE = "file-integrity-check";
/** Weekly, Sunday 03:00 server time — a quiet hour for reading every stored file. */
const WEEKLY_CRON = "0 3 * * 0";
const PAGE_SIZE = 200;
/** How many affected records the notification names before "and N more". */
const LISTED_RECORDS = 10;

/**
 * US-OPS-28 — reads every stored file, compares it with its SHA-256 and
 * records the outcome on the `files` row. Files stored before checksums
 * existed get one from their current bytes, so the first run is also the
 * one-off backfill (queued at start-up while any file still lacks one).
 *
 * When a run finds damaged or missing files, each affected organisation's
 * Owners get an in-app notification (event `files_damaged`) naming the
 * records, and the dashboard shows the warning until the files are intact
 * again. A run where everything matches shows nothing.
 */
@Injectable()
export class FileIntegrityWorker implements OnModuleInit {
  private readonly logger = new Logger(FileIntegrityWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly filesService: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(FILE_INTEGRITY_QUEUE, WEEKLY_CRON);
    await this.queue.work(FILE_INTEGRITY_QUEUE, async () => {
      await this.run();
    });
    if (await this.filesService.hasFilesWithoutChecksum()) {
      await this.queue.send(FILE_INTEGRITY_QUEUE, { reason: "backfill" });
    }
  }

  /** Checks every file; returns the problems found, by organisation. */
  async run(): Promise<Map<string, FileRow[]>> {
    const problems = new Map<string, FileRow[]>();
    let checked = 0;
    let lastId: string | null = null;
    for (;;) {
      const page = await this.filesService.listAfter(lastId, PAGE_SIZE);
      if (!page.length) break;
      for (const file of page) {
        if (await this.filesService.verify(file)) {
          problems.set(file.orgId, [...(problems.get(file.orgId) ?? []), file]);
        }
      }
      checked += page.length;
      lastId = page[page.length - 1]!.id;
    }

    for (const [orgId, damaged] of problems) {
      await this.notifyOwners(orgId, damaged);
    }
    this.logger.log(`Checked ${checked} stored files; ${[...problems.values()].flat().length} damaged or missing`);
    return problems;
  }

  private async notifyOwners(orgId: string, damaged: FileRow[]) {
    const labels = await this.filesService.describe(orgId, damaged);
    const names = damaged.map((file) => labels.get(file.id)!);
    const listed = names.slice(0, LISTED_RECORDS).join("; ");
    const more = names.length > LISTED_RECORDS ? `; and ${names.length - LISTED_RECORDS} more` : "";
    const summary = filesDamagedMessage(damaged.length);
    await this.notifications.notify(orgId, {
      recipientRoles: ["owner"],
      subject: summary,
      text: `${summary}\n\nAffected: ${listed}${more}.`,
      inApp: { type: "files_damaged", message: `${summary} Affected: ${listed}${more}.`, link: "/dashboard" },
    });
  }
}

/** The owners' warning, worded for one file or several. */
export function filesDamagedMessage(count: number): string {
  return count === 1
    ? "1 stored file is damaged or missing — restore from your latest backup."
    : `${count} stored files are damaged or missing — restore from your latest backup.`;
}
