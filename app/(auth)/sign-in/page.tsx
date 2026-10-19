import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { configuredProviders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · 1Security",
  description: "Authenticate to the 1Security enterprise security platform.",
};

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in to 1Security"
      subtitle="Enterprise security operations, identity and threat intelligence."
      footer={
        <span>
          Protected by adaptive threat detection and full audit logging.
        </span>
      }
    >
      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-xl bg-white/[0.03]" />
        }
      >
        <SignInForm providers={configuredProviders} />
      </Suspense>
    </AuthShell>
  );
}
