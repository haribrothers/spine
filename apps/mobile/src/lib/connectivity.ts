import { useSyncExternalStore } from "react";

/**
 * Whether the phone has a connection (expo-network, wired up by
 * `SyncProvider`). Starts as online until the first reading.
 */
let online = true;
const listeners = new Set<() => void>();

export const connectivity = {
  get: () => online,
  set(next: boolean) {
    if (next === online) return;
    online = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useOnline(): boolean {
  return useSyncExternalStore(connectivity.subscribe, connectivity.get, connectivity.get);
}
