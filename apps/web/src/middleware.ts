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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const authed = await hasSession(request);
    const target = authed ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(target, request.url));
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const authed = await hasSession(request);

  if (isProtected && !authed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && authed) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/onboarding/:path*", "/contacts/:path*", "/login", "/signup"],
};
