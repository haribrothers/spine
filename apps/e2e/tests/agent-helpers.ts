import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const APP_URL = process.env.APP_URL ?? "http://localhost:3110";
export const AGENT_CALLBACK = "http://localhost:47998/callback";

/** A local agent (like Claude Code): registers itself and comes back to a localhost callback. */
export class Agent implements OAuthClientProvider {
  url: URL | null = null;
  private info: OAuthClientInformationMixed | undefined;
  private saved: OAuthTokens | undefined;
  private verifier = "";
  constructor(private readonly name = "E2E Agent") {}
  get redirectUrl() {
    return AGENT_CALLBACK;
  }
  get clientMetadata() {
    return { client_name: this.name, redirect_uris: [AGENT_CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
  }
  clientInformation() {
    return this.info;
  }
  saveClientInformation(i: OAuthClientInformationMixed) {
    this.info = i;
  }
  tokens() {
    return this.saved;
  }
  saveTokens(t: OAuthTokens) {
    this.saved = t;
  }
  redirectToAuthorization(u: URL) {
    this.url = u;
  }
  saveCodeVerifier(v: string) {
    this.verifier = v;
  }
  codeVerifier() {
    return this.verifier;
  }
}

export const transportFor = (agent: Agent) => new StreamableHTTPClientTransport(new URL(`${API_URL}/mcp`), { authProvider: agent });

/** Turns Connected agents on as the page's signed-in Owner. */
export async function turnOnAgents(page: Page) {
  const res = await page.request.put(`${API_URL}/org/agents`, { data: { enabled: true }, headers: { "Idempotency-Key": randomUUID() } });
  if (!res.ok()) throw new Error(`Turning agents on failed: ${res.status()}`);
}

/** Connects an agent as the page's signed-in person, answering Allow through the API (US-MCP-03 tests the pages). */
export async function connectAgentAs(page: Page, agent: Agent): Promise<Client> {
  const first = transportFor(agent);
  await new Client({ name: "e2e", version: "1.0.0" }).connect(first).catch(() => {});
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const authorize = await fetch(agent.url!, { headers: { cookie, accept: "text/html" }, redirect: "manual" });
  const consentUrl = authorize.headers.get("location") ?? ((await authorize.json()) as { url: string }).url;
  const consent = await fetch(`${API_URL}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", origin: APP_URL },
    body: JSON.stringify({ accept: true, oauth_query: new URL(consentUrl).search.slice(1) }),
  });
  const { url } = (await consent.json()) as { url: string };
  await first.finishAuth(new URL(url).searchParams.get("code")!);
  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(transportFor(agent));
  return client;
}
