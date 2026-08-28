"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Capability } from "@spine/shared";
import { apiClient } from "./api-client";
import { authClient } from "./auth-client";

type CapabilitiesState = {
  /** `null` while the initial fetch is in flight. */
  capabilities: Record<Capability, boolean> | null;
  loading: boolean;
};

const CapabilitiesContext = createContext<CapabilitiesState>({ capabilities: null, loading: true });

/**
 * Fetches the current user's effective capability set once per session
 * (`GET /org/members/me/capabilities`, backed by `getEffectiveCapabilities`
 * on the API — see that function's own doc comment) and makes it available
 * to the whole authenticated app tree via `useCapability`/`useCapabilities`
 * below. Mounted once in `AppLayout` so every page shares one fetch instead
 * of each capability-gated button re-fetching independently.
 *
 * UX-only: hiding/disabling a button the caller can't use. The API
 * independently re-checks every mutating request server-side regardless of
 * what this returns — never treat a `true` here as a security boundary.
 */
export function CapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const [capabilities, setCapabilities] = useState<Record<Capability, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Record<Capability, boolean>>("/org/members/me/capabilities")
      .then((result) => {
        if (!cancelled) setCapabilities(result);
      })
      .catch(() => {
        // No session / not a member yet (e.g. mid-onboarding) — leave
        // capabilities null. Every consumer treats null the same as "no
        // capability granted" (see useCapability below), so this fails
        // closed rather than showing actions that would just 403.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CapabilitiesContext.Provider value={{ capabilities, loading }}>{children}</CapabilitiesContext.Provider>;
}

/** The full state — use when a component needs to distinguish "still loading" from "loaded and false" (e.g. to avoid a flash of a hidden button before the fetch resolves). */
export function useCapabilities(): CapabilitiesState {
  return useContext(CapabilitiesContext);
}

/**
 * The common case: "does the current user have this one capability."
 * Returns `false` while loading or if the fetch failed — a capability-gated
 * button stays hidden until proven grantable, rather than flashing visible
 * then disappearing.
 */
export function useCapability(capability: Capability): boolean {
  const { capabilities } = useCapabilities();
  return capabilities?.[capability] ?? false;
}

/**
 * The own/others pattern's UI-side mirror of `requireOwnershipCapability`
 * on the API (`capability.util.ts`) — same "own" definition: the record's
 * `createdByUserId` (or per-module equivalent, e.g. meetings'
 * `organizerUserId`) matches the current session user, `null`/unset counts
 * as unowned (only `others` can apply). Every module wiring up own/others
 * buttons should go through this rather than re-deriving the own-vs-others
 * branch inline, so the UI's notion of "own" can never quietly drift from
 * the server's.
 */
export function useCanEditOwnership(recordCreatedByUserId: string | null, capabilities: { own: Capability; others: Capability }): boolean {
  const { data: session } = authClient.useSession();
  const { capabilities: caps } = useCapabilities();
  if (!caps || !session?.user?.id) return false;
  const isOwn = recordCreatedByUserId !== null && recordCreatedByUserId === session.user.id;
  return caps[isOwn ? capabilities.own : capabilities.others] ?? false;
}
