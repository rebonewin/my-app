import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password · 1Security",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="All other sessions are signed out when the password changes."
    >
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-xl bg-white/[0.03]" />
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
