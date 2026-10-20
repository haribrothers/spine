import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";
import { fetchClientMetadataResource as fetchPinned } from "@better-auth/cimd/node";

/**
 * US-MCP-03 (07-security, "Fetching client metadata") — how Spine fetches a
 * connecting agent's Client ID Metadata Document: Better Auth's Node
 * transport resolves the host once, accepts only public addresses, pins the
 * connection and never follows a redirect. CIMD also refuses a `client_id`
 * that isn't a public https URL before anything is fetched.
 *
 * Tests can't reach a public https address, so they swap in an in-memory
 * transport; that's refused outside a test run.
 */
let testTransport: ClientMetadataResourceFetch | null = null;

export function useClientMetadataFetchForTests(fetcher: ClientMetadataResourceFetch | null): void {
  if (!process.env.VITEST) throw new Error("Only tests can replace how client metadata is fetched.");
  testTransport = fetcher;
}

export const fetchClientMetadataResource: ClientMetadataResourceFetch = (input, init) => (testTransport ?? fetchPinned)(input, init);
