/** A field AI may fill: nothing typed in it yet. */
export function isEmptyField(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
}

export interface AiFill<T> {
  /** The form's values with AI's suggestions in the fields that were empty. */
  next: T;
  /** The fields AI filled — each marked "Suggested by AI" until the person changes it. */
  filled: (keyof T)[];
  /** The fields the person had already filled where AI suggests something else — "Replace my entries (<n>)". */
  kept: (keyof T)[];
}

/**
 * US-AI-07 and the shared rules (D-242) — AI fills only empty fields.
 * Call it with the form's values as they are when the answer arrives
 * (a state updater), so anything typed while AI was working stays. A
 * suggestion Spine couldn't use reaches here as no value, and its field
 * stays empty.
 */
export function fillEmpty<T extends Record<string, unknown>>(current: T, suggestion: Partial<T>): AiFill<T> {
  const next = { ...current };
  const filled: (keyof T)[] = [];
  const kept: (keyof T)[] = [];
  for (const key of Object.keys(suggestion) as (keyof T)[]) {
    const value = suggestion[key];
    if (isEmptyField(value)) continue;
    if (isEmptyField(current[key])) {
      next[key] = value as T[keyof T];
      filled.push(key);
    } else if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      kept.push(key);
    }
  }
  return { next, filled, kept };
}
