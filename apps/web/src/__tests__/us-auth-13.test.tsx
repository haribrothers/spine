// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

/** The API as the middleware sees it: a session or not, and whether the install has any account. */
function api({ session = false, newInstall = false, down = false }: { session?: boolean; newInstall?: boolean; down?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (down) throw new Error("connection refused");
      if (url.endsWith("/api/auth/get-session")) return new Response(JSON.stringify(session ? { session: { id: "s" } } : null), { status: 200 });
      if (url.endsWith("/public/signup-status")) return new Response(JSON.stringify({ open: newInstall, businessName: null, newInstall }), { status: 200 });
      return new Response("{}", { status: 404 });
    }),
  );
}

async function visit(path: string, cookie = false) {
  const res = await middleware(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie: "better-auth.session_token=x" } : {} }));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("US-AUTH-13 · see a welcome page on a new install", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends / and /login to the welcome page while the install has no account", async () => {
    api({ newInstall: true });
    expect(await visit("/")).toBe("/welcome");
    expect(await visit("/login")).toBe("/welcome");
    expect(await visit("/welcome")).toBeNull();
  });

  it("is the login page once an account exists", async () => {
    api({ newInstall: false });
    expect(await visit("/")).toBe("/login");
    expect(await visit("/welcome")).toBe("/login");
    expect(await visit("/login")).toBeNull();
  });

  it("sends someone signed in to their dashboard", async () => {
    api({ session: true, newInstall: false });
    expect(await visit("/welcome", true)).toBe("/dashboard");
    expect(await visit("/", true)).toBe("/dashboard");
  });

  it("keeps the login page working when the API can't be reached", async () => {
    api({ down: true });
    expect(await visit("/login")).toBeNull();
    expect(await visit("/")).toBe("/login");
  });
});
