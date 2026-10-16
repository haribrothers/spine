import { and, eq, inArray, sql } from "drizzle-orm";
import { resolveModules, type ModuleKey, type ModuleSettings, type SwitchableModuleKey } from "@spine/shared";
import type { Database, Transaction } from "../db/client";
import { settings } from "../db/schema";

export const MODULES_KEY = "modules";
/** US-AI-01 — the AI assistant's settings; it's on only while `enabled` is (D-242). */
export const AI_SETTINGS_KEY = "ai";
const TTL_MS = 5_000;
const cache = new Map<string, { at: number; value: ModuleSettings }>();

/**
 * US-SET-23/24 (D-154) — the organisation's module switches (every module on
 * unless switched off). Read on every request a module owns, so it's kept
 * for a few seconds; switching one clears it at once (`forgetModules`).
 * The AI assistant (US-AI-01) is on only while its own settings say so.
 */
export async function loadModules(db: Database | Transaction, orgId: string): Promise<ModuleSettings> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.orgId, orgId), inArray(settings.key, [MODULES_KEY, AI_SETTINGS_KEY])));
  const saved = rows.find((r) => r.key === MODULES_KEY)?.value as Partial<ModuleSettings> | null | undefined;
  const ai = (rows.find((r) => r.key === AI_SETTINGS_KEY)?.value as { enabled?: unknown } | undefined)?.enabled === true;
  const value: ModuleSettings = { ...resolveModules(saved), ...(ai ? { ai: true } : {}) };
  cache.set(orgId, { at: Date.now(), value });
  return value;
}

export function forgetModules(orgId: string): void {
  cache.delete(orgId);
}

export async function moduleOn(db: Database | Transaction, orgId: string, key: ModuleKey): Promise<boolean> {
  return (await loadModules(db, orgId))[key] === true;
}

/** Organisations that have switched a module off — for scheduled jobs that run across every organisation. */
export async function orgsWithModuleOff(db: Database, key: SwitchableModuleKey): Promise<Set<string>> {
  const rows = await db
    .select({ orgId: settings.orgId })
    .from(settings)
    .where(and(eq(settings.key, MODULES_KEY), sql`(${settings.value} ->> ${key}) = 'false'`));
  return new Set(rows.map((r) => r.orgId));
}
