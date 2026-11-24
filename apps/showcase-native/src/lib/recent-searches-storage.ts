import * as SecureStore from "expo-secure-store";

const KEY = "spine.showcase-native.recent-searches";
const MAX_ENTRIES = 8;

/**
 * Persists recent search queries across reloads via `expo-secure-store` —
 * same mechanism `theme-storage.ts` already uses on this native-only app.
 * A plain JSON-encoded string array; `SecureStore`'s per-value size limit
 * (2048 bytes on iOS Keychain) is nowhere near a concern for a short list
 * of search terms, so no additional size handling is needed.
 */
export async function getRecentSearches(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** Moves `query` to the front (de-duping any existing occurrence), capped at `MAX_ENTRIES`. */
export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches();
  const existing = await getRecentSearches();
  const next = [trimmed, ...existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ENTRIES);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
