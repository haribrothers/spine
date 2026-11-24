import { useEffect } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { connectivity } from "../connectivity";
import { useSession } from "../session/session-provider";
import { outbox } from "./outbox";
import { syncEngine } from "./sync-engine";

const reachable = (state: Network.NetworkState) => state.isConnected !== false && state.isInternetReachable !== false;

/**
 * Wires the outbox to the app (US-MOB-07, US-MOB-08): it belongs to the
 * signed-in person on their server, sends through their session, starts
 * when something is queued, and again when the phone comes back online or
 * to the foreground. Offline it says so and keeps everything.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { state, request, updateRequired } = useSession();
  const signedIn = state.status === "signedIn" ? state.session : null;
  const owner = signedIn ? `${signedIn.server}|${signedIn.member.email.toLowerCase()}` : null;

  useEffect(() => {
    if (!owner || updateRequired) {
      syncEngine.setTransport(null);
      return;
    }
    let cancelled = false;
    void outbox.claim(owner).then(() => {
      if (cancelled) return;
      syncEngine.setTransport(request);
      void syncEngine.run();
    });
    return () => {
      cancelled = true;
    };
  }, [owner, request, updateRequired]);

  useEffect(() => outbox.onAdded(() => void syncEngine.run({ force: true })), []);

  useEffect(() => {
    let cancelled = false;
    void Network.getNetworkStateAsync()
      .then((first) => {
        if (cancelled) return;
        connectivity.set(reachable(first));
        syncEngine.setOnline(reachable(first));
      })
      .catch(() => undefined);
    const network = Network.addNetworkStateListener((next) => {
      connectivity.set(reachable(next));
      syncEngine.setOnline(reachable(next));
    });
    const app = AppState.addEventListener("change", (next) => {
      if (next === "active") void syncEngine.run();
    });
    return () => {
      cancelled = true;
      network.remove();
      app.remove();
    };
  }, []);

  return <>{children}</>;
}
