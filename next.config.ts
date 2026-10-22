import type { NextConfig } from "next";

/**
 * Headers that are safe to apply to every response.
 *
 * `Content-Security-Policy` is intentionally set in `proxy.ts` instead of here
 * because it is document-specific and must be kept out of JSON/RSC responses.
 * HSTS is left to the Vercel edge, which already sends
 * `max-age=63072000; includeSubDomains; preload`; adding a second HSTS header
 * would only risk conflicting values. COEP is intentionally omitted: the app
 * does not need SharedArrayBuffer, and `require-corp` can break cross-origin
 * avatar/profile images and other auth-adjacent browser flows.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-XSS-Protection", value: "0" },
];

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  experimental: {
    agentFeedback: true,
    // Enables `forbidden()` / `unauthorized()` from `next/navigation`, used by
    // the RBAC guards so an unauthorized page renders a real 403 boundary
    // instead of a redirect that fails once streaming has started.
    authInterrupts: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Applies to HTML, API responses and static assets alike. The headers
        // are response metadata and do not change asset semantics; keeping the
        // match broad avoids gaps on new routes.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Route handlers are all authenticated or auth-flow responses. Never
        // let a CDN or browser retain them.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
  // Pin the workspace root to this repository. Without it Next walks up to the
  // parent directory, finds an unrelated lockfile and emits a workspace warning.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
