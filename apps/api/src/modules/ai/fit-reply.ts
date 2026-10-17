import type { ZodType } from "zod";

/**
 * US-AI-07 (R-23) — every AI reply is checked against a fixed schema
 * before it reaches a form. Fields are checked one at a time: a field
 * that fails its check is left out (the form keeps it empty) and the rest
 * still fill. A field in `lists` is an array of rows checked the same way,
 * row by row. Anything not in the shape is dropped, so text in a document
 * can't add fields of its own.
 */
export type ReplyShape = Record<string, ZodType>;

export interface FittedReply<T> {
  value: Partial<T>;
  /** The fields left out because they failed their check — `lines.2.quantity` for a row's field. */
  dropped: string[];
}

/** The JSON object in a model's text: bare, or in a ```json fence; anything else is null. */
export function parseAiJson(raw: unknown): Record<string, unknown> | null {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = (fenced ? fenced[1]! : raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fitFields(shape: ReplyShape, source: Record<string, unknown>, prefix: string, dropped: string[]): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(shape)) {
    const raw = source[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const checked = schema.safeParse(raw);
    if (checked.success) value[key] = checked.data;
    else dropped.push(`${prefix}${key}`);
  }
  return value;
}

/** Fits a model's reply to `shape`, and each row of every list in `lists` to its row shape. */
export function fitAiReply<T>(raw: unknown, shape: ReplyShape, lists: Record<string, ReplyShape> = {}): FittedReply<T> {
  const dropped: string[] = [];
  const source = parseAiJson(raw);
  if (!source) return { value: {}, dropped: ["*"] };
  const value = fitFields(shape, source, "", dropped);
  for (const [key, rowShape] of Object.entries(lists)) {
    const rows = source[key];
    if (rows === undefined || rows === null) continue;
    if (!Array.isArray(rows)) {
      dropped.push(key);
      continue;
    }
    value[key] = rows
      .map((row, i) => (row !== null && typeof row === "object" && !Array.isArray(row) ? fitFields(rowShape, row as Record<string, unknown>, `${key}.${i}.`, dropped) : (dropped.push(`${key}.${i}`), null)))
      .filter((row): row is Record<string, unknown> => row !== null && Object.keys(row).length > 0);
  }
  return { value: value as Partial<T>, dropped };
}
