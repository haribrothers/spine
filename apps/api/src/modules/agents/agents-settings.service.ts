import { Inject, Injectable } from "@nestjs/common";
import { DEFAULT_AGENTS, agentsAddressReachable, type AgentsSettings, type AgentsSettingsUpdate } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { settings as settingsTable } from "../../db/schema";
import { AGENTS_SETTINGS_KEY, forgetModules } from "../../common/modules";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";
import { mcpUrl } from "./mcp-url";

interface StoredAgents {
  enabled: boolean;
  drafts: boolean;
}

/**
 * US-MCP-02 (D-256, D-258) — Settings › Connected agents. Off by default;
 * an Owner switches it on (the web asks first) and can stop agents creating
 * drafts. Both changes are audited, and switching clears the module cache so
 * `/mcp` follows at once.
 */
@Injectable()
export class AgentsSettingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
  ) {}

  async get(orgId: string): Promise<AgentsSettings> {
    return present(await this.stored(orgId));
  }

  async stored(orgId: string): Promise<StoredAgents> {
    const raw = await this.settings.get<Partial<StoredAgents>>(orgId, AGENTS_SETTINGS_KEY);
    return { enabled: raw?.enabled === true, drafts: raw?.drafts ?? DEFAULT_AGENTS.drafts };
  }

  async update(orgId: string, actorUserId: string, input: AgentsSettingsUpdate): Promise<AgentsSettings> {
    const current = await this.stored(orgId);
    const next: StoredAgents = { enabled: input.enabled ?? current.enabled, drafts: input.drafts ?? current.drafts };
    const changes = [
      ...(current.enabled !== next.enabled ? [{ field: "Connected agents", from: onOff(current.enabled), to: onOff(next.enabled) }] : []),
      ...(current.drafts !== next.drafts ? [{ field: "Agents can create drafts", from: onOff(current.drafts), to: onOff(next.drafts) }] : []),
    ];
    if (changes.length) {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(settingsTable)
          .values({ orgId, key: AGENTS_SETTINGS_KEY, value: next })
          .onConflictDoUpdate({ target: [settingsTable.orgId, settingsTable.key], set: { value: next, updatedAt: new Date() } });
        await this.audit.record(tx, { orgId, actorUserId, action: "updated", entityType: "agents_settings", entityId: orgId, contactId: null, changes });
      });
    }
    if (current.enabled !== next.enabled) forgetModules(orgId);
    return present(next);
  }
}

const onOff = (on: boolean) => (on ? "On" : "Off");

function present(s: StoredAgents): AgentsSettings {
  const url = mcpUrl();
  return { enabled: s.enabled, drafts: s.drafts, mcpUrl: url, httpsReachable: agentsAddressReachable(url) };
}
