import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Edge proxy (Next.js 16 renamed middleware to proxy).
 *
 * This is an *optimistic* gate only: it checks that a session cookie exists so
 * unauthenticated users never see a flash of protected UI. It does NOT validate
 * the session — a forged cookie would pass here. Every protected page and route
 * handler re-validates through `requireAuth`, which is the real boundary.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/scanner",
  "/reports",
  "/history",
  "/profile",
  "/settings",
  "/security",
  "/sessions",
  "/devices",
  "/audit",
  "/admin",
  "/organization",
  "/accept-invitation",
  "/two-factor",
  "/api-keys",
];

const AUTH_PAGES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/magic-link",
  "/two-factor",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "1security",
  });

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Two-factor challenge must be reachable both signed-in (mid-challenge) and
  // signed-out (after the challenge expires).
  if (pathname === "/two-factor") return NextResponse.next();

  if (isProtected && !sessionCookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (sessionCookie && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip static assets, image optimization and the auth API itself.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
