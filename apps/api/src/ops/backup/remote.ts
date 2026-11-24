import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * US-OPS-03 (D-105) — the off-site copy: `BACKUP_REMOTE=s3://<bucket>/<folder>`
 * on AWS S3, Cloudflare R2, Backblaze B2 or any S3-compatible store
 * (`BACKUP_REMOTE_ENDPOINT` for anything but AWS), with its own keys
 * (`BACKUP_REMOTE_ACCESS_KEY`, `BACKUP_REMOTE_SECRET_KEY`), never the file
 * storage's. Only encrypted archives are uploaded.
 */
export interface RemoteConfig {
  bucket: string;
  prefix: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function remoteConfig(env: NodeJS.ProcessEnv = process.env): RemoteConfig | null {
  const target = env.BACKUP_REMOTE?.trim();
  if (!target) return null;
  const match = /^s3:\/\/([^/]+)\/?(.*)$/.exec(target);
  if (!match) throw new Error(`BACKUP_REMOTE must look like s3://bucket/folder (got: ${target}).`);
  if (!env.BACKUP_REMOTE_ACCESS_KEY || !env.BACKUP_REMOTE_SECRET_KEY) throw new Error("BACKUP_REMOTE is set, so BACKUP_REMOTE_ACCESS_KEY and BACKUP_REMOTE_SECRET_KEY are needed too.");
  const prefix = match[2]!.replace(/\/+$/, "");
  return {
    bucket: match[1]!,
    prefix: prefix ? `${prefix}/` : "",
    endpoint: env.BACKUP_REMOTE_ENDPOINT || undefined,
    region: env.BACKUP_REMOTE_REGION || "auto",
    accessKeyId: env.BACKUP_REMOTE_ACCESS_KEY,
    secretAccessKey: env.BACKUP_REMOTE_SECRET_KEY,
  };
}

function client(config: RemoteConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

const NAME = /^spine-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.tar\.gz(\.enc)?$/;

function takenAt(name: string): Date | null {
  const m = NAME.exec(name);
  return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!)) : null;
}

/** ISO week, e.g. "2026-W43". */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Which remote backups to delete (D-105): keep the newest of each of the 7
 * most recent days that have a backup, then, older than those, the newest
 * of each of 4 weeks — 11 copies at most. Names that aren't backups are left alone.
 */
export function backupsToPrune(names: string[], days = 7, weeks = 4): string[] {
  const dated = names.map((name) => ({ name, at: takenAt(name) })).filter((b): b is { name: string; at: Date } => b.at !== null);
  dated.sort((a, b) => b.at.getTime() - a.at.getTime());
  const keep = new Set<string>();
  const seenDays = new Set<string>();
  let oldestDaily: Date | null = null;
  for (const b of dated) {
    const day = b.at.toISOString().slice(0, 10);
    if (seenDays.has(day)) continue;
    if (seenDays.size === days) break;
    seenDays.add(day);
    keep.add(b.name);
    oldestDaily = b.at;
  }
  const seenWeeks = new Set<string>();
  for (const b of dated) {
    if (seenWeeks.size === weeks) break;
    if (oldestDaily && b.at.toISOString().slice(0, 10) >= oldestDaily.toISOString().slice(0, 10)) continue;
    const week = isoWeek(b.at);
    if (seenWeeks.has(week)) continue;
    seenWeeks.add(week);
    keep.add(b.name);
  }
  return dated.filter((b) => !keep.has(b.name)).map((b) => b.name);
}

/** Uploads the archive, then prunes the folder. Returns the object key and how many old copies were deleted. */
export async function uploadAndPrune(config: RemoteConfig, archive: string): Promise<{ key: string; pruned: number }> {
  const s3 = client(config);
  try {
    const key = `${config.prefix}${basename(archive)}`;
    await s3.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: createReadStream(archive), ContentLength: (await stat(archive)).size, ContentType: "application/octet-stream" }));
    const names: string[] = [];
    let token: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: config.prefix, ContinuationToken: token }));
      for (const object of page.Contents ?? []) if (object.Key) names.push(object.Key.slice(config.prefix.length));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    const prune = backupsToPrune(names.filter((n) => !n.includes("/")));
    for (let i = 0; i < prune.length; i += 1000) {
      await s3.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: prune.slice(i, i + 1000).map((n) => ({ Key: `${config.prefix}${n}` })) } }));
    }
    return { key, pruned: prune.length };
  } finally {
    s3.destroy();
  }
}
