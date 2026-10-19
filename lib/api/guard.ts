import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext, hasEffectivePermission, type AuthContext } from "@/lib/auth/server";
import type { Permission } from "@/lib/rbac/permissions";

export type GuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/**
 * Authentication + RBAC gate for route handlers.
 *
 * Returns the resolved context on success, or a ready-to-return response on
 * failure so handlers stay linear:
 *
 *   const gate = await guard("session:revoke");
 *   if (!gate.ok) return gate.response;
 */
export async function guard(permission: Permission): Promise<GuardResult> {
  const ctx = await getAuthContext();

  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (!hasEffectivePermission(ctx, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your role does not permit this action." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, ctx };
}

/** Parse and validate a JSON body, returning a 400 response on failure. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid request body.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
