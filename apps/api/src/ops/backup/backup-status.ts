import { and, asc, eq } from "drizzle-orm";
import { BACKUP_STALE_DAYS, type BackupStatus, wholeDaysBetween } from "@spine/shared";
import type { Database } from "../../db/client";
import { organization, settings } from "../../db/schema";

export const LAST_BACKUP_KEY = "last_backup_at";

/** A backup covers the whole install, so every organisation's `last_backup_at` moves. */
export async function recordBackup(db: Database, at: Date): Promise<void> {
  const orgs = await db.select({ id: organization.id }).from(organization);
  for (const org of orgs) {
    await db
      .insert(settings)
      .values({ orgId: org.id, key: LAST_BACKUP_KEY, value: at.toISOString() })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: at.toISOString(), updatedAt: new Date() } });
  }
}

/** US-OPS-03 — counted from the last backup, or from when the business started using Spine. */
export async function backupStatus(db: Database, orgId: string, now = new Date()): Promise<BackupStatus> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, LAST_BACKUP_KEY))).limit(1);
  const last = typeof row?.value === "string" ? new Date(row.value) : null;
  let since = last;
  if (!since) {
    const [org] = await db.select({ createdAt: organization.createdAt }).from(organization).where(eq(organization.id, orgId)).orderBy(asc(organization.createdAt)).limit(1);
    since = org?.createdAt ?? now;
  }
  const daysSince = wholeDaysBetween(since, now);
  return { lastBackupAt: last?.toISOString() ?? null, daysSince, stale: now.getTime() - since.getTime() > BACKUP_STALE_DAYS * 86_400_000 };
}
