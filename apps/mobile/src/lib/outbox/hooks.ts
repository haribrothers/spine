import { useSyncExternalStore } from "react";
import { syncEngine, type SyncState } from "./sync-engine";

/** Whether the outbox is sending and why it can't (US-MOB-08). */
export function useSyncState(): SyncState {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.snapshot, syncEngine.snapshot);
}
