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
