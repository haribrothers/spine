import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export const AGENT_REDIRECT = "http://localhost:47999/callback";

/** An MCP client's OAuth state, as Claude or ChatGPT would keep it — registration by CIMD (`clientMetadataUrl`) or DCR. */
export class TestAgent implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  private info: OAuthClientInformationMixed | undefined;
  private saved: OAuthTokens | undefined;
  private verifier = "";

  constructor(
    private readonly name = "Test Agent",
    readonly clientMetadataUrl?: string,
    private readonly scope = "spine:read spine:draft offline_access",
  ) {}

  get redirectUrl() {
    return AGENT_REDIRECT;
  }
  get clientMetadata(): OAuthClientMetadata {
    return { client_name: this.name, redirect_uris: [AGENT_REDIRECT], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: this.scope };
  }
  clientInformation() {
    return this.info;
  }
  saveClientInformation(info: OAuthClientInformationMixed) {
    this.info = info;
  }
  tokens() {
    return this.saved;
  }
  saveTokens(tokens: OAuthTokens) {
    this.saved = tokens;
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }
  saveCodeVerifier(v: string) {
    this.verifier = v;
  }
  codeVerifier() {
    return this.verifier;
  }
}

export const mcpClient = (baseUrl: string, agent: TestAgent) => {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), { authProvider: agent });
  return { client: new Client({ name: "test-agent", version: "1.0.0" }), transport };
};

const origin = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The browser half of sign-in: the signed-in person's GET of the authorize URL, which lands on Spine's consent page. */
export async function openAuthorize(agent: TestAgent, cookie: string): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(agent.authorizationUrl!, { headers: { cookie, accept: "text/html" }, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) return { status: res.status, location: res.headers.get("location"), body: "" };
  // Without a browser's navigation headers Better Auth answers the redirect as JSON.
  const text = await res.text();
  const json = (() => {
    try {
      return JSON.parse(text) as { url?: string };
    } catch {
      return {};
    }
  })();
  return { status: res.status, location: json.url ?? null, body: text.slice(0, 400) };
}

/** Pressing Allow (or Cancel) on the consent page: Better Auth's `oauth2/consent` with the page's signed query. */
export async function answerConsent(baseUrl: string, cookie: string, consentPageUrl: string, answer: { accept: boolean; scope?: string }) {
  return fetch(`${baseUrl}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", origin: origin() },
    body: JSON.stringify({ ...answer, oauth_query: new URL(consentPageUrl).search.slice(1) }),
  });
}

/**
 * The whole connection, as an agent and a person in a browser would do it:
 * the agent is refused, discovers how to sign in, registers and sends the
 * person to authorize; they Allow; the agent exchanges the code and connects.
 */
export async function connectAgent(baseUrl: string, cookie: string, agent: TestAgent, answer: { scope?: string } = {}) {
  const first = mcpClient(baseUrl, agent);
  await first.client.connect(first.transport).then(
    () => {
      throw new Error("Expected the agent to be asked to sign in first.");
    },
    (err: unknown) => {
      if (!(err instanceof UnauthorizedError)) throw err;
    },
  );
  const { location, status, body: page } = await openAuthorize(agent, cookie);
  if (!location) throw new Error(`Authorize didn't redirect to the consent page: ${status} ${page}`);
  const consent = await answerConsent(baseUrl, cookie, location, { accept: true, ...answer });
  const body = (await consent.json()) as { url?: string; message?: string };
  if (!body.url) throw new Error(`Consent failed: ${consent.status} ${JSON.stringify(body)}`);
  const code = new URL(body.url).searchParams.get("code");
  if (!code) throw new Error(`No code in ${body.url}`);
  await first.transport.finishAuth(code);
  const connected = mcpClient(baseUrl, agent);
  await connected.client.connect(connected.transport);
  return connected.client;
}
