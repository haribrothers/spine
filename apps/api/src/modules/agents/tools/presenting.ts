import { formatMoney } from "@spine/shared";
import { appUrl } from "../../email/email-layout";
import { AgentCallError } from "../agent-call-error";

/** Amount fields Spine sends as minor units (strings), next to a `currency`. */
const MONEY_KEY = /(amount|total|subtotal|balance|outstanding|paid|due|value|tax|price|cost|credit)$/i;
const MINOR = /^-?\d+$/;

/**
 * What an agent gets back (D-259): Spine's own answer, with every amount
 * also formatted ("$1,250.00") next to its minor units, so the model never
 * has to divide by 100. Customer-written text stays as it is — it's data.
 */
export function withFormattedMoney(value: unknown, locale: string, currency?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => withFormattedMoney(v, locale, currency));
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const own = typeof obj.currency === "string" ? obj.currency : currency;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(obj)) {
    out[key] = withFormattedMoney(v, locale, own);
    if (own && typeof v === "string" && MINOR.test(v) && MONEY_KEY.test(key) && !key.endsWith("Id")) {
      try {
        out[`${key}Formatted`] = formatMoney(v, own, locale);
      } catch {
        /* not money after all */
      }
    }
  }
  return out;
}

/** A tool's answer: readable JSON for the model, and the same as structured content. */
export function toolResult(data: unknown) {
  const structured = (data && typeof data === "object" && !Array.isArray(data) ? data : { items: data }) as Record<string, unknown>;
  return { content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
}

/** A refusal in Spine's words, with what to do next; never a stack trace. */
export function toolError(err: unknown) {
  const message =
    err instanceof AgentCallError
      ? err.status === 403
        ? err.message || "You don't have permission to do that in Spine."
        : err.message
      : "Spine couldn't answer that. Try again.";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export const webLink = (path: string) => appUrl(path);
