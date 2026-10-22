import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/server";

/**
 * Entry point. Signed-in operators go straight to the dashboard; everyone else
 * lands on the real sign-in screen.
 */
export async function GET(request: Request) {
  const context = await getAuthContext();
  return NextResponse.redirect(
    new URL(context ? "/dashboard" : "/sign-in", request.url),
  );
}
