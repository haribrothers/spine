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

/** US-AI-03 (D-162, D-165) — each AI feature has its own switch, on by default once AI is on. */
export const AI_FEATURE_KEYS = ["readDocuments", "draftEmails", "draftQuoteLines", "bankSuggestions"] as const;
export type AiFeatureKey = (typeof AI_FEATURE_KEYS)[number];
export type AiFeatures = Record<AiFeatureKey, boolean>;
export const DEFAULT_AI_FEATURES: AiFeatures = { readDocuments: true, draftEmails: true, draftQuoteLines: true, bankSuggestions: true };
/** How `ai_requests.feature` names each one. */
export const AI_REQUEST_FEATURE: Record<AiFeatureKey, string> = { readDocuments: "read_document", draftEmails: "draft_email", draftQuoteLines: "draft_quote_lines", bankSuggestions: "bank_suggestions" };

/** US-AI-04 (D-168) — per person, at most 30 AI requests in 10 minutes. */
export const AI_RATE_LIMIT = { requests: 30, minutes: 10 } as const;

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
  /** US-AI-03 */
  features: AiFeatures;
  /** US-AI-04 — tokens a month; null for no limit. */
  monthlyTokenBudget: number | null;
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
  features: { ...DEFAULT_AI_FEATURES },
  monthlyTokenBudget: null,
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
    /** US-AI-03 — any of the switches; the rest stay as saved. */
    features: z.object(Object.fromEntries(AI_FEATURE_KEYS.map((k) => [k, z.boolean().optional()])) as Record<AiFeatureKey, z.ZodOptional<z.ZodBoolean>>).strict().optional(),
    /** US-AI-04 — whole tokens a month, or null for no limit. */
    monthlyTokenBudget: z.number().int("Enter a whole number of tokens.").min(1_000, "Enter at least 1,000 tokens, or leave it empty for no limit.").max(1_000_000_000_000).nullable().optional(),
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

/** US-AI-04 — `GET /org/ai/usage?month=YYYY-MM`. */
export interface AiUsage {
  month: string;
  budget: number | null;
  /** Tokens in and out this month. */
  used: number;
  requests: number;
  /** 0–100+, or null with no budget. */
  percent: number | null;
  /** Most tokens first. */
  byFeature: { feature: AiFeatureKey; tokens: number; percent: number }[];
  byUser: { userId: string; name: string; tokens: number; percent: number }[];
  /** "2026-11-01" while this month's budget is used up. */
  pausedUntil: string | null;
}

/** `GET /ai/status` — what a member's screens need to show or hide AI controls. */
export interface AiStatus {
  /** US-AI-05 — Owners, and Staff on a Team with "Use AI features". */
  canUse: boolean;
  /** US-AI-05 — Field: only "Read receipt" on their own expense, on the phone. */
  canReadOwnReceipt: boolean;
  supportsImages: boolean | null;
  features: AiFeatures;
  /** "2026-11-01" while this month's budget is used up; controls show disabled with `aiPausedMessage`. */
  pausedUntil: string | null;
}

export const AI_FEATURE_OFF_ERROR = "AI_FEATURE_OFF";
export const AI_NOT_ALLOWED_MESSAGE = "You don't have the right to use AI. An owner can give it to your Team.";
export const AI_RATE_LIMIT_ERROR = "AI_RATE_LIMIT";
export const AI_BUDGET_USED_ERROR = "AI_BUDGET_USED";
export const AI_RATE_LIMIT_MESSAGE = "Too many AI requests. Try again in a few minutes.";
export const AI_UNAVAILABLE_ERROR = "AI_UNAVAILABLE";
export const AI_TIMEOUT_ERROR = "AI_TIMEOUT";
/** US-AI-07 — the provider didn't answer, or answered with an error. */
export const AI_UNAVAILABLE_MESSAGE = "AI didn't answer. Fill this in by hand or try again.";
export const AI_BUDGET_WARNING_MESSAGE = "AI has used 80% of this month's budget.";
/** "1 November" from "2026-11-01". */
export const aiPauseDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
export const aiPausedMessage = (until: string) => `AI is paused until ${aiPauseDate(until)} — this month's budget is used up.`;
export const aiFeatureOffMessage = (key: AiFeatureKey) => `${AI_FEATURES.find((f) => f.key === key)!.label} is switched off in Settings › AI assistant.`;

/** US-AI-08 (D-170) — an image (or a scanned PDF) and a model that can't read images. */
export const AI_NO_IMAGES_ERROR = "AI_NO_IMAGES";
export const AI_NO_IMAGES_MESSAGE = "Your AI model can't read images. Choose a model that can, or enter the bill by hand.";
/** US-AI-09 — the same, on the expense form. */
export const AI_NO_IMAGES_RECEIPT_MESSAGE = "Your AI model can't read images. Choose a model that can, or enter the expense by hand.";
/** US-AI-08 — a file AI can't read (an HEIC photo, a spreadsheet). */
export const AI_UNREADABLE_FILE_MESSAGE = "AI can read PDFs and JPEG, PNG or WebP photos. Save it as one of those, or enter it by hand.";

/** US-AI-08, US-AI-09 — `POST /ai/read-document`: a vendor's bill, or a receipt for an expense. */
export const AI_DOCUMENT_TARGETS = ["vendor_bill", "expense"] as const;
export type AiDocumentTarget = (typeof AI_DOCUMENT_TARGETS)[number];
export const readDocumentSchema = z.object({
  fileId: z.uuid("Choose a file to read."),
  target: z.enum(AI_DOCUMENT_TARGETS),
});
export type ReadDocumentInput = z.infer<typeof readDocumentSchema>;

/** A line read from a document, matched to the business's items, taxes and accounts by Spine (D-170). */
export interface DocumentSuggestionLine {
  name: string;
  description: string | null;
  hsnSac: string | null;
  quantity: number;
  /** Minor units, before tax. */
  unitPriceAmount: string;
  /** The tax the document shows, as a percentage. */
  taxPercent: number | null;
  /** The document's prices include tax. */
  isTaxInclusive: boolean;
  /** One of these when a rate or group matches `taxPercent`; neither for no tax or no match. */
  taxRateId: string | null;
  taxGroupId: string | null;
  catalogItemId: string | null;
  accountId: string | null;
  /** Where the account came from: this vendor's last bill or the matched item. */
  accountFrom: "last_bill" | "item" | null;
}

/** US-AI-08 — what AI read from a vendor's bill, after Spine matched and checked it. Nothing is saved. */
export interface DocumentSuggestion {
  /** The vendor as read; `contactId` when it matches one of your vendors. */
  vendor: { contactId: string | null; name: string } | null;
  number: string | null;
  date: string | null;
  dueDate: string | null;
  /** The words the due date came from ("Payment due within 30 days"), when it wasn't printed as a date. */
  dueNote: string | null;
  currency: string | null;
  /** The GST place of supply: the matched vendor's, else the document's. */
  placeOfSupply: string | null;
  lines: DocumentSuggestionLine[];
  /** The total printed on the document, in minor units. */
  documentTotal: string | null;
  /** The lines' total as Spine computes it, in minor units. */
  computedTotal: string;
  /** How long the provider took. */
  readMs: number;
  /** True when the document was sent as images (a photo or a scanned PDF). */
  readAsImages: boolean;
}

/** US-AI-09 — what AI read from a receipt for the expense form, after Spine matched and checked it. Nothing is saved. */
export interface ReceiptSuggestion {
  merchant: string | null;
  /** "<merchant> — <what was bought>", for Description (expenses have no vendor field). */
  description: string | null;
  date: string | null;
  currency: string | null;
  /** The total paid, tax included, in minor units. */
  amount: string | null;
  /** The tax the receipt shows, in minor units; null when it shows none (the category's rate then applies). */
  taxAmount: string | null;
  taxPercent: number | null;
  /** A rate with the receipt's percentage, when one matches. */
  taxRateId: string | null;
  /** The receipt's own tax lines ("CGST 9%", minor units), for "From the receipt: …". */
  taxLines: { name: string; amount: string }[];
  categoryId: string | null;
  /** Where the category came from: this merchant's past expenses, or the categories' names and what they're for. */
  categoryFrom: "merchant" | "category" | null;
  /** How many of the merchant's recent expenses had that category ("As on your last 3 expenses from …"). */
  merchantExpenses: number;
  readMs: number;
  readAsImages: boolean;
}

/** "As on your last 3 expenses from HP Fuel Centre." */
export const aiCategoryFromMerchant = (count: number, merchant: string) => `As on your last ${count === 1 ? "expense" : `${count} expenses`} from ${merchant}.`;

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
] as const satisfies readonly { key: AiFeatureKey; label: string; where: string; sends: string }[];
