import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { configuredProviders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Verify email · 1Security",
};

/** Reads `searchParams`, so it must render per request. */
export const instant = false;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const justVerified = params.verified === "true";

  return (
    <AuthShell
      title={justVerified ? "Email verified" : "Verify your email"}
      subtitle={
        justVerified
          ? undefined
          : `Confirm ownership of your address to unlock every feature${
              configuredProviders.email ? "" : " once email delivery is configured"
            }.`
      }
    >
      <VerifyEmailPanel
        initialEmail={params.email}
        justVerified={justVerified}
      />
    </AuthShell>
  );
}
