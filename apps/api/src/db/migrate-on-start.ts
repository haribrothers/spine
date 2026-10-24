import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Any two API containers starting together take this lock in turn, so one migrates and the other finds nothing to do. */
const MIGRATION_LOCK = 7_301_042;

/** Where the migrations ship: `apps/api/drizzle`, next to `dist/`. */
export const MIGRATIONS_FOLDER = resolve(__dirname, "../../drizzle");

/** How many pre-migration snapshots to keep (D-264). */
export const SNAPSHOTS_KEPT = 3;

export interface MigrationResult {
  applied: number;
  total: number;
  /** The snapshot written before applying, when there was data to protect. */
  snapshot?: string;
}

export interface MigrateOptions {
  folder?: string;
  /**
   * US-OPS-50 (D-264): before applying migrations to a database that holds
   * data, write a pg_dump snapshot here (the last three are kept).
   */
  snapshotDir?: string;
  /** Refuse to migrate if the snapshot can't be written (production); otherwise just warn. */
  requireSnapshot?: boolean;
  pgDump?: string;
  log?: (line: string) => void;
  now?: Date;
}

/** Thrown when the database is left as it was (a snapshot failed, or the migrations rolled back). */
export class MigrationError extends Error {
  constructor(
    message: string,
    readonly snapshot?: string,
  ) {
    super(message);
  }
}

function dump(pgDump: string, databaseUrl: string, target: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pgDump, ["--format=custom", "--no-owner", "--no-privileges", "--dbname", databaseUrl], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const out = createWriteStream(target, { mode: 0o600 });
    child.stdout?.pipe(out);
    child.on("error", (err) => reject(err));
    child.on("close", (code) => out.close(() => (code === 0 ? resolvePromise() : reject(new Error(stderr.trim().split("\n").pop() || `exit ${code}`)))));
  });
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/**
 * US-OPS-01, US-OPS-50 (D-264) — brings the database up to date before the API
 * serves anything: a fresh install creates its tables, an upgrade applies
 * what's new. Runs Drizzle's migrator (the same files and journal
 * `drizzle-kit migrate` uses) on its own connection, holding a Postgres
 * advisory lock. Drizzle applies all pending migrations in one transaction,
 * so a failure leaves the database as it was; on a database with data, a
 * pg_dump snapshot is written first all the same.
 */
export async function migrateOnStart(databaseUrl: string, options: MigrateOptions = {}): Promise<MigrationResult> {
  const folder = options.folder ?? MIGRATIONS_FOLDER;
  const log = options.log ?? (() => {});
  const journal = (JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as { entries: unknown[] }).entries;
  const total = journal.length;
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  let snapshot: string | undefined;
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK})`;
    const applied = async () => {
      const [row] = await client<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
      return row?.n ?? 0;
    };
    const before = await applied();
    const pending = total - before;
    if (pending > 0 && options.snapshotDir) {
      const [orgs] = await client<{ n: number }[]>`select count(*)::int as n from public.organization`.catch(() => [{ n: 0 }]);
      if ((orgs?.n ?? 0) > 0) {
        await mkdir(options.snapshotDir, { recursive: true });
        snapshot = join(options.snapshotDir, `spine-snapshot-${stamp(options.now ?? new Date())}-before-${pending}-migration${pending === 1 ? "" : "s"}.dump`);
        try {
          log(`Taking a snapshot of the database before ${pending} migration${pending === 1 ? "" : "s"}…`);
          await dump(options.pgDump ?? "pg_dump", databaseUrl, snapshot);
          const old = (await readdir(options.snapshotDir)).filter((f) => /^spine-snapshot-.*\.dump$/.test(f)).sort().reverse().slice(SNAPSHOTS_KEPT);
          for (const f of old) await rm(join(options.snapshotDir, f), { force: true });
        } catch (err) {
          await rm(snapshot, { force: true });
          snapshot = undefined;
          const reason = err instanceof Error ? err.message : String(err);
          if (options.requireSnapshot) throw new MigrationError(`Couldn't take the snapshot before migrating, so nothing was changed: ${reason}`);
          log(`Couldn't take a snapshot before migrating (${reason}); migrating anyway, outside production.`);
        }
      }
    }
    try {
      await migrate(drizzle(client), { migrationsFolder: folder });
    } catch (err) {
      throw new MigrationError(`A migration failed, so none were applied and the database is as it was: ${err instanceof Error ? err.message : String(err)}`, snapshot);
    }
    return { applied: (await applied()) - before, total, ...(snapshot ? { snapshot } : {}) };
  } finally {
    await client`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    await client.end();
  }
}
