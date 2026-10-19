import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Enables `forbidden()` / `unauthorized()` from `next/navigation`, used by
    // the RBAC guards so an unauthorized page renders a real 403 boundary
    // instead of a redirect that fails once streaming has started.
    authInterrupts: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
