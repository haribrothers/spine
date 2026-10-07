import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { defaultTallyGroup, TALLY_GROUPS, type PutTallyMapping, type TallyGroup, type TallyMappingRow } from "@spine/shared";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { accounts, moneyAccounts } from "../../../db/schema";
import { SettingsService } from "../../org/settings.service";

export const TALLY_MAPPING_KEY = "tally_mapping";
export const UNKNOWN_ACCOUNT = "That account isn't in your chart of accounts.";

/**
 * US-RPT-39 (D-149) — the Tally group each account lands in: the saved
 * choice (`settings.tally_mapping`, `{ [accountId]: group }`), else the
 * default for its type and code (`defaultTallyGroup`).
 */
@Injectable()
export class TallyMappingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async rows(orgId: string): Promise<TallyMappingRow[]> {
    const chart = await this.db.select().from(accounts).where(eq(accounts.orgId, orgId)).orderBy(asc(accounts.code));
    const money = await this.db.select({ accountId: moneyAccounts.accountId, kind: moneyAccounts.kind }).from(moneyAccounts).where(eq(moneyAccounts.orgId, orgId));
    const saved = (await this.settings.get<Record<string, string>>(orgId, TALLY_MAPPING_KEY)) ?? {};
    return chart.map((a) => {
      const chosen = saved[a.id];
      const valid = chosen && (TALLY_GROUPS as readonly string[]).includes(chosen) ? (chosen as TallyGroup) : null;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        tallyGroup: valid ?? defaultTallyGroup({ code: a.code, type: a.type, moneyAccountKind: money.find((m) => m.accountId === a.id)?.kind ?? null }),
        isDefault: !valid,
      };
    });
  }

  /** Merges the groups into what's saved; every account must be the organisation's. */
  async save(orgId: string, input: PutTallyMapping): Promise<TallyMappingRow[]> {
    const ids = new Set((await this.db.select({ id: accounts.id }).from(accounts).where(eq(accounts.orgId, orgId))).map((a) => a.id));
    if (input.mappings.some((m) => !ids.has(m.accountId))) throw new BadRequestException(UNKNOWN_ACCOUNT);
    const saved = (await this.settings.get<Record<string, string>>(orgId, TALLY_MAPPING_KEY)) ?? {};
    for (const m of input.mappings) saved[m.accountId] = m.tallyGroup;
    await this.settings.set(orgId, TALLY_MAPPING_KEY, saved);
    return this.rows(orgId);
  }
}
