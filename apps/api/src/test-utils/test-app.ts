import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module";
import { installBigIntJsonSerialization } from "../common/bigint-json";
import { requestLogging } from "../common/logging/request-logging";

export interface TestApp {
  app: INestApplication;
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * First HTTP-level test harness in this codebase — every prior
 * "integration" test calls services/guards directly against real Postgres,
 * never through actual NestJS routing, so @OrgRoles/CapabilityGuard were
 * never exercised as a real request would hit them (auth middleware,
 * guard order, route matching included). This boots the REAL AppModule
 * (same module graph app.module.ts wires for production, not a trimmed
 * test module) against the real dev/test Postgres — matching this
 * codebase's existing "hit real Postgres, don't mock" convention — and
 * listens on an ephemeral port so tests can issue real `fetch` requests,
 * cookies and all, instead of calling service methods directly.
 *
 * bodyParser stays disabled, matching main.ts's own comment: Better Auth
 * reads the raw request body itself.
 */
export async function createTestApp(options: { port?: number } = {}): Promise<TestApp> {
  installBigIntJsonSerialization();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  // As main.ts: every request gets an id (US-OPS-07); its log line only with LOG_REQUESTS=on.
  app.use(requestLogging());
  await app.init();
  // Ephemeral port — parallel test files never collide. A fixed port is for
  // flows where the server's own address matters (OAuth issuer and MCP
  // resource, US-MCP-03): those files set API_URL to it before loading the app.
  await app.listen(options.port ?? 0);
  const address = app.getHttpServer().address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = options.port ? `http://localhost:${port}` : `http://127.0.0.1:${port}`;

  return {
    app,
    baseUrl,
    close: () => app.close(),
  };
}

/**
 * Signs up via the real HTTP endpoint (not auth.api.signUpEmail directly,
 * unlike signup.integration.test.ts) so the session cookie this returns is
 * exactly what a real browser would receive — needed to then issue
 * authenticated requests against @OrgRoles/@RequireCapability-guarded
 * routes with the same cookie-jar semantics production traffic has.
 */
export async function signUp(
  baseUrl: string,
  input: { email: string; password: string; name: string },
): Promise<{ userId: string; cookie: string }> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Signup failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { user: { id: string } };
  const cookie = extractCookie(res);
  return { userId: body.user.id, cookie };
}

/** Better Auth issues the session cookie via Set-Cookie on the signup response — carry it forward as the Cookie header on subsequent requests, same as a browser would. */
function extractCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("No Set-Cookie header on response");
  }
  // Multiple Set-Cookie headers can arrive folded into one string
  // (comma-joined) depending on the fetch implementation — split on the
  // `; ` cookie-attribute boundary isn't reliable for that case, so just
  // take each cookie's own `name=value` pair up to its first `;`.
  return setCookie
    .split(/,(?=[^;]+?=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}
