import { and, eq, sql } from "drizzle-orm";
import { resolveModules, type ModuleKey, type ModuleSettings } from "@spine/shared";
import type { Database, Transaction } from "../db/client";
import { settings } from "../db/schema";

export const MODULES_KEY = "modules";
const TTL_MS = 5_000;
const cache = new Map<string, { at: number; value: ModuleSettings }>();

/**
 * US-SET-23/24 (D-154) — the organisation's module switches (every module on
 * unless switched off). Read on every request a module owns, so it's kept
 * for a few seconds; switching one clears it at once (`forgetModules`).
 */
export async function loadModules(db: Database | Transaction, orgId: string): Promise<ModuleSettings> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const [row] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, MODULES_KEY)));
  const value = resolveModules(row?.value as Partial<ModuleSettings> | null);
  cache.set(orgId, { at: Date.now(), value });
  return value;
}

export function forgetModules(orgId: string): void {
  cache.delete(orgId);
}

export async function moduleOn(db: Database | Transaction, orgId: string, key: ModuleKey): Promise<boolean> {
  return (await loadModules(db, orgId))[key];
}

/** Organisations that have switched a module off — for scheduled jobs that run across every organisation. */
export async function orgsWithModuleOff(db: Database, key: ModuleKey): Promise<Set<string>> {
  const rows = await db
    .select({ orgId: settings.orgId })
    .from(settings)
    .where(and(eq(settings.key, MODULES_KEY), sql`(${settings.value} ->> ${key}) = 'false'`));
  return new Set(rows.map((r) => r.orgId));
}
