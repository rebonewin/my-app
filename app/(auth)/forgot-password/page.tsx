import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { configuredProviders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Reset password · 1Security",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email a single-use link that expires in one hour."
    >
      <ForgotPasswordForm emailConfigured={configuredProviders.email} />
    </AuthShell>
  );
}
