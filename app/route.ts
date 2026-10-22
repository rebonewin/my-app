import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/server";

/**
 * Entry point. Signed-in operators go straight to the dashboard; everyone else
 * lands on the real sign-in screen.
 */
export async function GET(request: Request) {
  const context = await getAuthContext();
  const response = NextResponse.redirect(
    new URL(context ? "/dashboard" : "/sign-in", request.url),
  );
  // This decision depends on the caller's session. Never let a browser or CDN
  // reuse one visitor's redirect for another visitor.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}
