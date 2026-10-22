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
  "/activity",
  "/findings",
  "/reports",
  "/history",
  "/profile",
  "/settings",
  "/security",
  "/security-score",
  "/ssl-analyzer",
  "/technology",
  "/threat-intelligence",
  "/compliance",
  "/ai-assistant",
  "/assets",
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

/**
 * Document CSP for every HTML response.
 *
 * Next.js 16 renders these routes with Cache Components/PPR. A per-request
 * nonce cannot be embedded in the prerendered static shell, and the Next.js
 * documentation explicitly lists PPR as incompatible with nonce-based CSP.
 * Using a nonce-only policy would therefore block the framework bootstrap
 * scripts on the static shell. `'unsafe-inline'` is required for those inline
 * scripts, but the policy still locks down sources, framing, forms, plugins and
 * transport. Inline style attributes (charts, progress bars and the SOC theme)
 * also require `'unsafe-inline'` for styles.
 */
const isDev = process.env.NODE_ENV === "development";

function contentSecurityPolicy(upgradeInsecureRequests: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function hardenResponse(
  response: NextResponse,
  upgradeInsecureRequests: boolean,
): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(upgradeInsecureRequests),
  );
  // Every document is session-dependent or is an authentication screen. Do
  // not let browsers or intermediary caches retain it.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secure = request.nextUrl.protocol === "https:";
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "1security",
  });

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Two-factor challenge must be reachable both signed-in (mid-challenge) and
  // signed-out (after the challenge expires).
  if (pathname === "/two-factor") {
    return hardenResponse(NextResponse.next(), secure);
  }

  if (isProtected && !sessionCookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return hardenResponse(NextResponse.redirect(url), secure);
  }

  if (sessionCookie && AUTH_PAGES.includes(pathname)) {
    return hardenResponse(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      secure,
    );
  }

  return hardenResponse(NextResponse.next(), secure);
}

export const config = {
  matcher: [
    /*
     * Skip API routes, static assets and image optimization. The API has its
     * own JSON-appropriate headers and auth guards; CSP only applies to HTML.
     * Prefetches are intentionally still matched so the optimistic auth gate
     * behaves the same for navigations and prefetches.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf)$).*)",
  ],
};
