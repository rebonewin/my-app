import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/server";

/** Session-dependent redirect, so never prerendered. */
export const instant = false;

/**
 * Entry point. Signed-in operators go straight to the dashboard; everyone else
 * lands on the real sign-in screen.
 */
export default async function RootPage() {
  const context = await getAuthContext();
  redirect(context ? "/dashboard" : "/sign-in");
}
