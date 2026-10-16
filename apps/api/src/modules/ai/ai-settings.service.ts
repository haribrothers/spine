import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AI_CONNECT_PROVIDER_FIRST,
  DEFAULT_AI_SETTINGS,
  aiAcknowledgeFirst,
  aiCouldntReach,
  aiProviderHost,
  aiProviderReady,
  isLocalAddress,
  maskedKey,
  type AiDriverKind,
  type AiProviderCheck,
  type AiSettings,
  type AiSettingsUpdate,
  type AiTestResult,
} from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { settings as settingsTable } from "../../db/schema";
import { AI_SETTINGS_KEY, forgetModules } from "../../common/modules";
import { openSecret, sealSecret } from "../../common/secret-box";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";
import { AiHttp, AiProviderError, createAiDriver, type AiProviderConfig } from "./drivers";

/** The sealed key lives under its own settings key, which data exports and the generic settings routes never return. */
export const AI_KEY_SETTING = "ai_provider_key";
const KEY_PURPOSE = "ai-provider-key";

/** `settings.ai` as stored — no secrets. */
interface StoredAi {
  enabled: boolean;
  driver: AiDriverKind;
  baseUrl: string | null;
  model: string | null;
  apiKeyHint: string | null;
  supportsImages: boolean | null;
  /** The provider host an Owner acknowledged data goes to (D-164). */
  acknowledgedHost: string | null;
}

const PROVIDER_LABEL: Record<AiDriverKind, string> = { none: "None", "openai-compatible": "Local or OpenAI-compatible", anthropic: "Anthropic Claude" };

/**
 * US-AI-01, US-AI-02 (D-162–D-164) — Settings › AI assistant. Owner-only.
 * AI is on only with a provider; turning it on with one outside the local
 * network needs the Owner's acknowledgement of where data goes, which is
 * audited. The key is sealed at rest and only its last four characters
 * ever leave this service. Testing the connection is the one provider
 * call made while AI is off, and only when an Owner presses it.
 */
@Injectable()
export class AiSettingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
    private readonly http: AiHttp,
  ) {}

  async get(orgId: string): Promise<AiSettings> {
    return present(await this.stored(orgId));
  }

  async update(orgId: string, actorUserId: string, input: AiSettingsUpdate): Promise<AiSettings> {
    const current = await this.stored(orgId);
    const next: StoredAi = { ...current };

    if (input.driver !== undefined && input.driver !== current.driver) {
      next.driver = input.driver;
      // Each provider has its own address and models; a key for one isn't a key for another.
      next.baseUrl = null;
      next.model = null;
      next.supportsImages = null;
    }
    if (input.baseUrl !== undefined && next.driver === "openai-compatible") next.baseUrl = input.baseUrl ? input.baseUrl.replace(/\/+$/, "") : null;
    if (input.model !== undefined) next.model = input.model;

    let keyChange: "replaced" | "removed" | null = null;
    const driverChanged = next.driver !== current.driver;
    if (input.apiKey !== undefined) {
      keyChange = "replaced";
      next.apiKeyHint = input.apiKey.slice(-4);
    } else if (input.clearApiKey || (driverChanged && current.apiKeyHint)) {
      keyChange = current.apiKeyHint ? "removed" : null;
      next.apiKeyHint = null;
    }
    if (next.driver === "none") next.enabled = false;

    const providerChanged = driverChanged || next.baseUrl !== current.baseUrl || next.model !== current.model || keyChange !== null;
    if (providerChanged) next.supportsImages = null;
    if (input.enabled !== undefined) next.enabled = input.enabled;

    const host = aiProviderHost(next.driver, next.baseUrl);
    if (next.enabled) {
      if (!aiProviderReady(next)) throw new BadRequestException(AI_CONNECT_PROVIDER_FIRST);
      // D-164: data leaves the server only after an Owner has acknowledged where it goes.
      if (!isLocal(next) && next.acknowledgedHost !== host) {
        if (!input.acknowledged) throw new BadRequestException(aiAcknowledgeFirst(host!));
        next.acknowledgedHost = host;
      }
    }

    await this.db.transaction(async (tx) => {
      if (input.apiKey !== undefined) await put(tx, orgId, AI_KEY_SETTING, { sealed: sealSecret(input.apiKey, KEY_PURPOSE) });
      else if (keyChange === "removed") await put(tx, orgId, AI_KEY_SETTING, { sealed: null });
      await put(tx, orgId, AI_SETTINGS_KEY, next);

      const changes = [
        ...(current.enabled !== next.enabled ? [{ field: "AI assistant", from: current.enabled ? "On" : "Off", to: next.enabled ? "On" : "Off" }] : []),
        ...(current.driver !== next.driver ? [{ field: "Provider", from: PROVIDER_LABEL[current.driver], to: PROVIDER_LABEL[next.driver] }] : []),
        ...(current.baseUrl !== next.baseUrl ? [{ field: "Server address", from: current.baseUrl ?? "", to: next.baseUrl ?? "" }] : []),
        ...(current.model !== next.model ? [{ field: "Model", from: current.model ?? "", to: next.model ?? "" }] : []),
        // Never the key — only that it changed, as its last four characters show it.
        ...(keyChange ? [{ field: "API key", from: maskedKey(current.apiKeyHint), to: keyChange === "removed" ? "Removed" : maskedKey(next.apiKeyHint) }] : []),
        ...(next.acknowledgedHost !== current.acknowledgedHost && next.acknowledgedHost ? [{ field: "Sends business data to", from: current.acknowledgedHost ?? "", to: next.acknowledgedHost }] : []),
      ];
      if (changes.length) {
        await this.audit.record(tx, { orgId, actorUserId, action: "updated", entityType: "ai_settings", entityId: orgId, contactId: null, changes });
      }
    });
    if (current.enabled !== next.enabled) forgetModules(orgId);
    return present(next);
  }

  /**
   * US-AI-02 — "Test connection": the models the provider lists, then a
   * one-token reply from the chosen model, first with a tiny image (to learn
   * whether it reads images) and, if that's refused, without. Uses what the
   * form has now; the saved key when no new one is typed.
   */
  async test(orgId: string, check: AiProviderCheck): Promise<AiTestResult> {
    const config = await this.configFor(orgId, check);
    const address = describe(config);
    try {
      const driver = createAiDriver(this.http, config);
      const models = await driver.listModels();
      if (!config.model) return { ok: true, model: null, supportsImages: null, models };
      let supportsImages = true;
      try {
        await driver.ping(config.model, true);
      } catch (err) {
        if (!(err instanceof AiProviderError) || err.kind !== "rejected") throw err;
        await driver.ping(config.model, false);
        supportsImages = false;
      }
      // Remember what the saved provider can do, so the features can say so (US-AI-02).
      const saved = await this.stored(orgId);
      if (sameProvider(saved, config)) await this.settings.set(orgId, AI_SETTINGS_KEY, { ...saved, supportsImages });
      return { ok: true, model: config.model, supportsImages, models };
    } catch (err) {
      const reason = err instanceof AiProviderError ? err.reason : "something went wrong";
      return { ok: false, model: config.model, supportsImages: null, models: [], error: aiCouldntReach(address, reason) };
    }
  }

  /** US-AI-02 — the models the provider lists, for the Model picker (people can type one it doesn't list). */
  async models(orgId: string, check: AiProviderCheck): Promise<{ models: string[]; error?: string }> {
    const config = await this.configFor(orgId, check);
    try {
      return { models: await createAiDriver(this.http, config).listModels() };
    } catch (err) {
      return { models: [], error: aiCouldntReach(describe(config), err instanceof AiProviderError ? err.reason : "something went wrong") };
    }
  }

  /** The saved provider, with its key, for the AI features. Null while AI is off or has no provider. */
  async provider(orgId: string): Promise<AiProviderConfig | null> {
    const saved = await this.stored(orgId);
    if (!saved.enabled || saved.driver === "none") return null;
    return { driver: saved.driver, baseUrl: saved.baseUrl, model: saved.model, apiKey: await this.savedKey(orgId) };
  }

  private async configFor(orgId: string, check: AiProviderCheck): Promise<AiProviderConfig> {
    const saved = await this.stored(orgId);
    const baseUrl = check.driver === "openai-compatible" ? (check.baseUrl ?? null) : null;
    if (check.driver === "openai-compatible" && !baseUrl) throw new BadRequestException("Enter the server address, starting with http:// or https://.");
    // The saved key only goes to the provider it was saved for.
    const apiKey = check.apiKey ?? (saved.driver === check.driver ? await this.savedKey(orgId) : null);
    if (check.driver === "anthropic" && !apiKey) throw new BadRequestException("Enter your Anthropic API key.");
    return { driver: check.driver, baseUrl: baseUrl?.replace(/\/+$/, "") ?? null, model: check.model ?? null, apiKey };
  }

  private async savedKey(orgId: string): Promise<string | null> {
    const row = await this.settings.get<{ sealed?: string | null }>(orgId, AI_KEY_SETTING);
    return openSecret(row?.sealed, KEY_PURPOSE);
  }

  private async stored(orgId: string): Promise<StoredAi> {
    const raw = await this.settings.get<Partial<StoredAi>>(orgId, AI_SETTINGS_KEY);
    return {
      enabled: raw?.enabled === true,
      driver: raw?.driver ?? "none",
      baseUrl: raw?.baseUrl ?? null,
      model: raw?.model ?? null,
      apiKeyHint: raw?.apiKeyHint ?? null,
      supportsImages: raw?.supportsImages ?? null,
      acknowledgedHost: raw?.acknowledgedHost ?? null,
    };
  }
}

async function put(tx: Transaction, orgId: string, key: string, value: object) {
  await tx
    .insert(settingsTable)
    .values({ orgId, key, value })
    .onConflictDoUpdate({ target: [settingsTable.orgId, settingsTable.key], set: { value, updatedAt: new Date() } });
}

const isLocal = (s: Pick<StoredAi, "driver" | "baseUrl">) => s.driver === "openai-compatible" && isLocalAddress(s.baseUrl);

function present(s: StoredAi): AiSettings {
  if (s.driver === "none") return { ...DEFAULT_AI_SETTINGS };
  return {
    enabled: s.enabled,
    driver: s.driver,
    baseUrl: s.baseUrl,
    model: s.model,
    apiKeyHint: s.apiKeyHint,
    supportsImages: s.supportsImages,
    providerHost: aiProviderHost(s.driver, s.baseUrl),
    local: isLocal(s),
  };
}

function describe(config: AiProviderConfig): string {
  return config.driver === "anthropic" ? "Anthropic" : (config.baseUrl ?? "the server");
}

function sameProvider(saved: StoredAi, config: AiProviderConfig): boolean {
  return saved.driver === config.driver && (saved.baseUrl ?? null) === (config.baseUrl ?? null) && saved.model === config.model;
}
