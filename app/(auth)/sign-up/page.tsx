import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { configuredProviders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account · 1Security",
  description: "Create a 1Security account.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle="Passwords are hashed with scrypt. Every sign-in is risk-scored."
    >
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-xl bg-white/[0.03]" />
        }
      >
        <SignUpForm providers={configuredProviders} />
      </Suspense>
    </AuthShell>
  );
}
