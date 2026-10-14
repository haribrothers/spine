import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

// /onboarding requires a session same as /dashboard, but is never forced —
// nothing here redirects an authenticated user *into* /onboarding; that
// only happens once, explicitly, from the signup flow's own redirect. A
// returning user visiting /dashboard directly is never bounced back into
// the wizard, per the "onboarding is not a gate" rule.
const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/contacts"];
const AUTH_PATHS = ["/login", "/signup"];

async function hasSession(request: NextRequest): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      return false;
    }
    const data = await res.json();
    return Boolean(data?.session);
  } catch {
    // API unreachable — fail open on protected routes would leak access, so
    // treat as unauthenticated instead.
    return false;
  }
}

/**
 * US-AUTH-13 (D-207) — whether this install has no account at all yet, so
 * signed-out visitors belong on the welcome page. Unknown (API down) counts
 * as "no": the login page still works and says what's wrong.
 */
async function isNewInstall(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/public/signup-status`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { newInstall?: boolean };
    return data.newInstall === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const authed = await hasSession(request);
    const target = authed ? "/dashboard" : (await isNewInstall()) ? "/welcome" : "/login";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // US-AUTH-13: the welcome page is for an install with no accounts; once there are, it's the login page.
  if (pathname === "/welcome") {
    if (await hasSession(request)) return NextResponse.redirect(new URL("/dashboard", request.url));
    if (!(await isNewInstall())) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const authed = await hasSession(request);

  if (isProtected && !authed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && authed) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  if (pathname === "/login" && (await isNewInstall())) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/welcome", "/dashboard/:path*", "/onboarding/:path*", "/contacts/:path*", "/login", "/signup"],
};
