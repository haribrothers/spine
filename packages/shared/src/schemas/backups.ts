/**
 * US-OPS-03 (D-105) — when Owners are told to back up: the last successful
 * backup is more than 2 days old, or there has never been one on an install
 * older than that.
 */
export const BACKUP_STALE_DAYS = 2;

export interface BackupStatus {
  /** The last successful `backup.sh` run; null if there hasn't been one. */
  lastBackupAt: string | null;
  /** Whole days since then (or, never backed up, since the install). */
  daysSince: number;
  stale: boolean;
}

/** "Your last backup was 3 days ago. Run a backup to keep your data safe." — null when there's nothing to say. */
export function backupWarningMessage(status: BackupStatus | null): string | null {
  if (!status?.stale) return null;
  if (!status.lastBackupAt) return "Spine hasn't been backed up yet. Run a backup to keep your data safe.";
  return `Your last backup was ${status.daysSince} day${status.daysSince === 1 ? "" : "s"} ago. Run a backup to keep your data safe.`;
}

/** Days between two instants, rounded down. */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}
