import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth catch-all handler.
 *
 * Better Auth owns CSRF (double-submit cookie + Origin validation), session
 * cookies, OAuth callbacks and rate limiting for every path below /api/auth.
 */
export const { GET, POST } = toNextJsHandler(auth);
