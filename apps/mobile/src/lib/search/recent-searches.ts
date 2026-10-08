import * as SecureStore from "expo-secure-store";

/**
 * US-MOB-23 — up to 10 recent searches, newest first, kept only on this
 * phone (the same per-device store as the appearance setting), never on
 * the server.
 */
const KEY = "spine.mobile.recent-searches";
export const MAX_RECENT_SEARCHES = 10;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

async function save(list: string[]): Promise<string[]> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(list));
  return list;
}

/** Moves `query` to the front (once, ignoring case), keeping 10. */
export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  const existing = await getRecentSearches();
  if (!trimmed) return existing;
  return save([trimmed, ...existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES));
}

export async function removeRecentSearch(query: string): Promise<string[]> {
  return save((await getRecentSearches()).filter((entry) => entry !== query));
}

export async function clearRecentSearches(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
