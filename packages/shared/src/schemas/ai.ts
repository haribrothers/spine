import { z } from "zod";

/**
 * US-AI-01, US-AI-02 (D-162–D-164, D-242) — Settings › AI assistant: one
 * switch for all AI, and the provider it talks to. The Owner brings their
 * own model: one on their own network, any OpenAI-compatible service, or
 * Anthropic with their own key. The key is stored encrypted by the API and
 * only ever comes back as its last four characters.
 */
export const AI_DRIVERS = ["none", "openai-compatible", "anthropic"] as const;
export type AiDriverKind = (typeof AI_DRIVERS)[number];

/** Every provider request gives up after this long (D-163). */
export const AI_TIMEOUT_MS = 30_000;

export const ANTHROPIC_HOST = "api.anthropic.com";

/** `GET /org/ai` — never the key itself. */
export interface AiSettings {
  enabled: boolean;
  driver: AiDriverKind;
  /** OpenAI-compatible only: e.g. `http://192.168.1.20:11434/v1`. */
  baseUrl: string | null;
  model: string | null;
  /** "1a2b" — the last four characters of the saved key, or null when there's none. */
  apiKeyHint: string | null;
  /** From the last successful Test connection; null until tested. */
  supportsImages: boolean | null;
  /** Where requests go ("api.anthropic.com", "192.168.1.20:11434"), or null with no provider. */
  providerHost: string | null;
  /** True when the provider is on the business's own network, so nothing leaves it. */
  local: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  driver: "none",
  baseUrl: null,
  model: null,
  apiKeyHint: null,
  supportsImages: null,
  providerHost: null,
  local: true,
};

const baseUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/[^\s/]+/i.test(v), "Enter the server address, starting with http:// or https://.");

/** `PUT /org/ai` — any of these; the rest stay as saved. */
export const aiSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    driver: z.enum(AI_DRIVERS).optional(),
    baseUrl: baseUrl.nullable().optional(),
    model: z.string().trim().min(1, "Enter a model.").max(200).nullable().optional(),
    /** A new key (replaces the saved one). */
    apiKey: z.string().trim().min(1).max(500).optional(),
    /** Removes the saved key. */
    clearApiKey: z.boolean().optional(),
    /** Turning on with a provider outside the local network needs this (D-164). */
    acknowledged: z.boolean().optional(),
  })
  .strict();
export type AiSettingsUpdate = z.infer<typeof aiSettingsUpdateSchema>;

/** `POST /org/ai/test` and `POST /org/ai/models` — the provider as the form has it now; the saved key is used when no new one is given. */
export const aiProviderCheckSchema = z
  .object({
    driver: z.enum(["openai-compatible", "anthropic"]),
    baseUrl: baseUrl.nullable().optional(),
    model: z.string().trim().min(1).max(200).nullable().optional(),
    apiKey: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type AiProviderCheck = z.infer<typeof aiProviderCheckSchema>;

export interface AiTestResult {
  ok: boolean;
  model: string | null;
  supportsImages: boolean | null;
  models: string[];
  error?: string;
}

export const AI_CONNECT_PROVIDER_FIRST = "Connect a provider first.";
export const aiAcknowledgeFirst = (host: string) => `Confirm what will be sent to ${host} first.`;
export const AI_ON_TOAST = "AI assistant is on";
export const AI_OFF_TOAST = "AI assistant is off";
export const AI_PANE_INTRO = "AI helps fill in forms — reading bills and receipts, drafting emails and quote lines, suggesting bank matches. It never saves, sends or posts anything by itself.";
export const AI_NEVER_SENT = "Never sent: bank account numbers, tax IDs and GSTINs, UPI IDs, passwords or keys.";
export const AI_NEEDS_IMAGES = "Needs a model that can read images. PDFs with text still work.";
export const aiTurnOnMessage = (host: string) => `Business data will be sent to ${host} when people use AI features. What each feature sends is listed below.`;
export const aiConnected = (model: string, supportsImages: boolean | null) =>
  `Connected · ${model} · reads images: ${supportsImages === null ? "not checked" : supportsImages ? "yes" : "no"}`;
export const aiCouldntReach = (address: string, reason: string) => `Couldn't reach ${address}: ${reason}. Check the address and key, then try again.`;

/** "••••1a2b" */
export const maskedKey = (hint: string | null) => (hint ? `••••${hint}` : "");

/** `http(s)://host[:port]…` → its host (lower-case, IPv6 without brackets) and port. Shared code has no `URL` global to lean on. */
function hostAndPort(url: string): { host: string; port: string | null } | null {
  const m = url.trim().match(/^https?:\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?(?:[/?#]|$)/i);
  if (!m) return null;
  return { host: m[1]!.toLowerCase().replace(/^\[|\]$/g, ""), port: m[2] ?? null };
}

/** Host (and port) a provider's requests go to, or null without one. */
export function aiProviderHost(driver: AiDriverKind, url: string | null | undefined): string | null {
  if (driver === "anthropic") return ANTHROPIC_HOST;
  if (driver !== "openai-compatible" || !url) return null;
  const parsed = hostAndPort(url);
  if (!parsed) return null;
  const host = parsed.host.includes(":") ? `[${parsed.host}]` : parsed.host;
  return parsed.port ? `${host}:${parsed.port}` : host;
}

/**
 * D-164 — whether an address is on the business's own network: localhost,
 * private IPv4 ranges, link-local, IPv6 loopback and unique-local, `.local`
 * and `.internal` names, and bare names (a container like `ollama`).
 * Anything else counts as leaving the server.
 */
export function isLocalAddress(url: string | null | undefined): boolean {
  if (!url) return false;
  const parsed = hostAndPort(url);
  if (!parsed) return false;
  const host = parsed.host;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa")) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (host.includes(":")) return host === "::1" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host);
  return !host.includes(".");
}

/** Whether the saved provider is complete enough to switch AI on (US-AI-01). */
export function aiProviderReady(s: Pick<AiSettings, "driver" | "baseUrl" | "model" | "apiKeyHint">): boolean {
  if (s.driver === "anthropic") return Boolean(s.apiKeyHint && s.model);
  if (s.driver === "openai-compatible") return Boolean(s.baseUrl && s.model);
  return false;
}

/** D-165 — each AI feature, where it shows and exactly what it sends (Settings › AI assistant and the turn-on confirm). */
export const AI_FEATURES = [
  {
    key: "readDocuments",
    label: "Read bills and receipts",
    where: "New vendor bill, the expense form and the Field app",
    sends: "the bill or receipt someone chooses to read — a PDF's text, or the image — and the names of your vendors and categories to match against.",
  },
  {
    key: "draftEmails",
    label: "Draft customer emails",
    where: "The send dialog for quotes, invoices, reminders, statements, receipts and credit notes",
    sends: "the email template, the document's number, amounts and dates, and the customer's name.",
  },
  {
    key: "draftQuoteLines",
    label: "Draft quote lines",
    where: "The quote builder",
    sends: "the enquiry and up to 50 matching catalogue items and bundles.",
  },
  {
    key: "bankSuggestions",
    label: "Suggest bank matches",
    where: "Reconcile — only when someone presses Suggest with AI",
    sends: "statement lines' dates, amounts and descriptions, with account numbers and IDs removed.",
  },
] as const;
export type AiFeatureKey = (typeof AI_FEATURES)[number]["key"];
